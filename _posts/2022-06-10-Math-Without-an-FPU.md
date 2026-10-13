---
layout: post
title: "Math Without an FPU"
date: 2022-06-10
---

On an STM32F072, multiplying two floats took 166 clock cycles, and multiplying two Q15 fixed-point numbers took 13. The chip is a Cortex-M0 with no floating point unit, so every float operation becomes a call into a software library, while fixed-point does the same math with plain integer instructions and keeps track of the binary point by convention.

Take a function that multiplies two floats, compiled with `arm-none-eabi-gcc` 10.3 at `-O2` for `-mcpu=cortex-m0`:

```c
float f_mul(float a, float b)
{
    return a * b;
}
```

It compiles to:

```
push  {r4, lr}
bl    __aeabi_fmul
pop   {r4, pc}
```

Every float multiply is a call into `libgcc`, which unpacks both numbers into sign, exponent and mantissa, multiplies the mantissas with integer instructions, then normalizes, rounds and packs the result. The routines it pulls into the binary are:

| Routine | Size |
|---|---|
| `__aeabi_fmul` (float multiply) | 588 bytes |
| `__aeabi_fadd` (float add) | 828 bytes |
| `__aeabi_lmul` (64-bit integer multiply) | 90 bytes |

On a part with 16 KB of flash, the float routines alone can take up a noticeable part of the budget.

## Fixed-Point and Q Formats

Fixed-point stores a fractional number as an integer, with an agreed position for the binary point. A number in $$Q_{m.n}$$ format has $$m$$ integer bits and $$n$$ fraction bits, and its value is:

$$\text{value} = \frac{\text{stored integer}}{2^n}$$

Two common formats are:

- Q15, a 16-bit signed integer with 15 fraction bits. It covers $$[-1, 1)$$ with a resolution of $$2^{-15} \approx 0.00003$$, which suits audio samples and DSP coefficients.
- Q16.16, a 32-bit signed integer split down the middle. It covers roughly $$\pm 32768$$ with a resolution of $$2^{-16} \approx 0.000015$$.

<p align="center">
  <img src="/content/a4/q_formats.svg"><br>
  <b>Figure 1:</b> Q15 and Q16.16 bit layouts. <small>(updated 2026)</small>
</p>

Two numbers in the same format can be added and subtracted as plain integers:

```c
q16_t q16_add(q16_t a, q16_t b) { return a + b; }
```

This compiles to a single `adds r0, r0, r1`, compared to a call into the 828-byte `__aeabi_fadd`.

## Multiplication

Multiplication needs a shift afterwards. Multiplying two Q15 numbers:

$$
\begin{aligned}
\frac{a}{2^{15}} \cdot \frac{b}{2^{15}} &= \frac{a \cdot b}{2^{30}}
\end{aligned}
$$

So the raw product is in Q30 and has to be shifted right by 15 to get back to Q15 $$\dots$$

$$\boxed{c = \frac{a \cdot b}{2^{15}}}$$

$$\dots$$ and since the product of two 16-bit numbers always fits in 32 bits, the multiply is a single `muls` instruction.

### Rounding

A plain right shift truncates, and since an arithmetic shift rounds toward negative infinity, the error is always in the same direction. Over thousands of operations, for example in a filter, that bias accumulates. Adding half of the last bit before shifting turns it into round-to-nearest:

$$c = \frac{a \cdot b + 2^{14}}{2^{15}}$$

### Overflow

Q15 can represent $$-1$$ but not $$+1$$, so there is exactly one product that overflows: $$-1 \times -1$$. To handle it, the result is saturated:

```c
q15_t q15_mul(q15_t a, q15_t b)
{
    int32_t p = (int32_t)a * b;
    p += 1 << 14;
    p >>= 15;
    if (p > INT16_MAX) p = INT16_MAX;
    if (p < INT16_MIN) p = INT16_MIN;
    return (q15_t)p;
}
```

GCC compiles this to:

```
movs   r3, #128
lsls   r3, r3, #7       ; r3 = 0x4000 (2^14)
mov    ip, r3
movs   r3, #128
muls   r1, r0           ; a * b
add    r1, ip           ; + 2^14
asrs   r0, r1, #15      ; >> 15
lsls   r3, r3, #8       ; r3 = 0x8000
cmp    r0, r3           ; did -1 * -1 overflow?
bne.n  16
ldr    r0, [pc, #4]     ; saturate to 0x7fff
sxth   r0, r0
bx     lr
```

GCC determined that the result can never go below `INT16_MIN`, so it removed the second check, and it turned the first check into an equality test against the one value that can overflow.

### Q16.16 Needs 64 Bits

For Q16.16 the product of two 32-bit numbers needs 64 bits before the shift. The Cortex-M0 has no 32x32 to 64-bit multiply instruction, so this also becomes a library call, to `__aeabi_lmul`. That routine is 90 bytes of integer code rather than the unpacking, normalizing and rounding done by `__aeabi_fmul`, but on an M0 only Q15 multiplication maps directly onto a hardware instruction.

## Benchmark

I ran each routine on a NUCLEO-F072RB (STM32F072, Cortex-M0) clocked from its 8 MHz internal oscillator with zero flash wait states. Each operation runs 1000 times over 64 pairs of random operands. The Cortex-M0 has no cycle counter, so the timing comes from the SysTick timer, which counts core clock cycles:

```c
static uint32_t run_f(float (*fn)(float, float))
{
    SYST_RVR = 0xFFFFFF;
    SYST_CVR = 0;

    // start the core clock 
    SYST_CSR = 5; 

    for (int i = 0; i < N; i++)
    {
        f_sink = fn(fa[i & (M - 1)], fb[i & (M - 1)]);
    }

    return 0xFFFFFF - SYST_CVR;
}
```

The same loop calling an empty function took 23 cycles per iteration, and that baseline is subtracted from each result:

| Operation | Cycles per op | vs. float multiply |
|---|---|---|
| `float` multiply | 166 | 1x |
| `float` add | 120 | 1.4x faster |
| Q16.16 multiply | 81 | 2x faster |
| Q15 multiply | 13 | 13x faster |
| Q16.16 add | 1 | 166x faster |

Q15 multiply is about 13 times faster than a float multiply, which matches it compiling to a single `muls` plus rounding and the saturation check. Q16.16 multiply is only about twice as fast because the 64-bit product goes through `__aeabi_lmul`. Addition shows the largest difference, at 1 cycle for Q16.16 against 120 for a float.

The speedup comes at the cost of tracking the format, rounding and saturating by hand. Q15 suits values that stay inside $$[-1, 1)$$, such as audio samples and filter coefficients, and gets the full benefit of the hardware multiply. Q16.16 covers a much wider range, but its 64-bit multiply makes it only about twice as fast as a float multiply, so most of its advantage is in addition and subtraction.

Using floats outside time-critical loops is still reasonable, as long as the flash for the float routines fits. Once `__aeabi_fmul` and `__aeabi_fadd` are linked in they take up their 1.4 KB whether they are called once or a million times, and only the time cost depends on how often they run.
