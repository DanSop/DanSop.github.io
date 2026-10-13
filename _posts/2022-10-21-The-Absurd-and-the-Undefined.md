---
layout: post
title: "The Absurd and the Undefined"
date: 2022-10-21
---

GCC compiles `return x + 1 > x;` to `return 1;`, deletes a null check that comes after a dereference, and returns a stale value when an `int` and a `float` pointer overlap. Each of those is allowed because the source code relies on undefined behavior, and on a microcontroller the last two can produce wrong values without any fault.

The C standard lists a long set of things a program must never do: overflow a signed integer, access an object through a pointer of the wrong type, dereference a null pointer, and so on. If a program does one of them, the standard places *no requirements at all* on what happens.

Compilers use this as an assumption. Since a valid program never overflows a signed integer, the compiler is allowed to assume that a signed addition never overflows, and to optimize based on that. All three examples below follow from that assumption. They were compiled with GCC 13 for x86-64 at `-O2` (plus `-fcf-protection=none`), so any of them can be pasted there to try.

The first case is signed overflow:

```c
int will_overflow(int x)
{
    return x + 1 > x;
}
```

Mathematically `x + 1 > x` is always true, but in 32-bit arithmetic it shouldn't be when `x` is `INT_MAX`, since `x + 1` wraps around to `INT_MIN`. GCC produces:

```
mov    eax, 0x1          // return value = 1
ret
```

The function is just `return 1`. Signed overflow is undefined, so the compiler assumes `x + 1` never wraps, which makes the comparison always true. GCC does this even at `-O0`. Making `x` unsigned, where wrapping is defined, keeps a real comparison, and so does compiling the signed version with `-fwrapv`, which tells GCC that signed overflow wraps:

```
xor    eax, eax          // result = 0
cmp    edi, 0x7fffffff   // is x == INT_MAX?
setne  al                // result = (x != INT_MAX)
ret
```

With wrapping defined, GCC works out that `x + 1 > x` is false for exactly one input, `INT_MAX`, and turns the whole function into `x != INT_MAX`. Without the flag, an overflow check written as `if (x + 1 < x)` on a signed type is removed from the program without any warning.

The second case is strict aliasing:

```c
int alias(int *a, float *b)
{
    *a = 1;
    *b = 2.0f;
    return *a;
}
```

If `a` and `b` point at the same memory, the store to `*b` overwrites `*a`, so the function should return the bits of `2.0f`. The aliasing rules say an `int` can't be accessed through a `float*`, so the compiler assumes the two pointers never overlap:

```
mov    DWORD PTR [rdi], 0x1          // *a = 1
mov    eax, 0x1                      // return value = 1, without re-reading *a
mov    DWORD PTR [rsi], 0x40000000   // *b = 2.0f
ret
```

It returns `1` from a register. With `-fno-strict-aliasing`, `*a` is read again after the store to `*b`:

```
mov    DWORD PTR [rdi], 0x1
mov    DWORD PTR [rsi], 0x40000000
mov    eax, DWORD PTR [rdi]          // re-read *a
ret
```

Embedded code runs into this often, for example when reading a byte buffer through a `uint32_t*` or reinterpreting a `float` as an integer. The safe way to reinterpret bits is `memcpy`, which the compiler turns into a register move anyway.

The third case is a null check placed after a dereference:

```c
int read_reg(int *p)
{
    int v = *p;
    if (p == 0)
    {
        return -1;
    }
    return v;
}
```

Dereferencing a null pointer is undefined. Since `*p` is read first, the compiler concludes that `p` can't be null by the time of the check, and removes the check as dead code:

```
mov    eax, DWORD PTR [rdi]   // return *p
ret
```

The same pattern caused a Linux kernel vulnerability in 2009, where a null check in the `tun` driver was removed for this reason. GCC's `-fno-delete-null-pointer-checks` keeps the check:

```
test   rdi, rdi                // is p null?
mov    eax, 0xffffffff         // result = -1
cmovne eax, DWORD PTR [rdi]    // if not null, result = *p
ret
```

On a computer the deleted check rarely changes the outcome, since reading address `0x0` crashes the program before the check would run. A Cortex-M is different. Address `0x0` is valid memory there, since the vector table is mapped to it, so reading `*p` with `p == 0` doesn't fault and returns the initial stack pointer. On a microcontroller the check is the only thing that would catch the bug, which makes `-fno-delete-null-pointer-checks` the flag most worth adding to firmware builds.

Most of these problems can be avoided by using unsigned types where wrapping is intended, checking for overflow before doing the arithmetic, reinterpreting bits with `memcpy` instead of pointer casts, and checking pointers before dereferencing them. A desktop build with `-fsanitize=undefined` catches most of the rest at runtime. When a codebase relies on one of these behaviors on purpose, `-fwrapv`, `-fno-strict-aliasing` and `-fno-delete-null-pointer-checks` make it defined. The Linux kernel builds with the last two, plus `-fno-strict-overflow`, which implies `-fwrapv` on modern GCC.
