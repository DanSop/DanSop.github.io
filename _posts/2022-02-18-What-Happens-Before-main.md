---
layout: post
title: "What Happens Before main()?"
date: 2022-02-18
---

If you have only written C for a computer, `main()` is where your program starts. Even there, some code runs first. On Linux the operating system loads your program from disk into memory, and execution begins in a function called `_start` that the C library adds to every program. `_start` sets up a few things and then calls `main()`. On a microcontroller there is no operating system to do that work, so the program has to carry its own startup code, and that code is what runs between power-on and the first line of `main()`.

The examples below come from a minimal program I built with `arm-none-eabi-gcc` 10.3 at `-O2` for a Cortex-M0 microcontroller with 64 KB of flash and 8 KB of RAM, using the same addresses as an STM32F0.

## Flash, RAM and Addresses

A microcontroller has two main kinds of memory:

- Flash is where the program is stored. It keeps its contents with the power off, which is why a board still runs its program after being unplugged. It can be read quickly, but writing to it is slow and is normally only done when you program the chip.
- RAM is where variables live while the program runs. It is fast to read and write, but it loses everything when the power goes off, and at power-on its contents are random.

Every byte of both memories has a number called its address. On an STM32F0, flash starts at address `0x08000000` and RAM starts at address `0x20000000`. A pointer in C is just one of these addresses, so a `uint32_t *` holding `0x20000000` points to the first word of RAM. The same idea applies to the chip's hardware, which also sits at fixed addresses, but for startup only flash and RAM matter.

## Registers, the Stack Pointer and the Program Counter

The processor itself does its work in a small set of registers. These are storage slots inside the CPU, each holding one 32-bit value, and every calculation happens in them. A Cortex-M0 has sixteen:

- `r0` to `r12` are general purpose, used for arithmetic, function arguments and return values.
- `r13` is the stack pointer, `SP`.
- `r14` is the link register, `LR`, which holds the address to return to when a function finishes.
- `r15` is the program counter, `PC`.

The program counter holds the address of the instruction the CPU is about to run. After each instruction the CPU moves the program counter forward, and a function call or a jump works by loading a new address into it. Whatever address is in `PC` is where the program is.

The stack is a region of RAM used for anything that only exists while a function is running: local variables, function arguments that don't fit in registers, and the return addresses of functions that called other functions. The stack pointer holds the address of the current top of the stack. When a function needs space it moves `SP` down, and when it returns it moves `SP` back up. On ARM the stack grows downward, so it normally starts at the very top of RAM and grows toward lower addresses.

Every C function uses the stack, so the stack pointer has to hold a valid RAM address before any C code can run. On a computer the operating system sets it up. On a microcontroller the hardware has to.

## Reset and the Vector Table

A reset puts the chip back into its starting state. It happens at power-on, when the reset button is pressed (the black button on a Nucleo board), when a watchdog timer expires, or when software asks for one. After a reset the CPU needs to know two things: where the stack is, and which instruction to run first.

A Cortex-M gets both from the vector table, a list of addresses stored at the start of flash. When the chip comes out of reset, the hardware does this before running any instruction:

1. Read the first word of the vector table and put it in the stack pointer.
2. Read the second word and put it in the program counter.

The CPU then starts running whatever code the program counter now points to. That code is called the reset handler. The rest of the table holds the addresses of handlers for interrupts and faults. An interrupt is a hardware event, such as a timer expiring or a button being pressed, that makes the CPU pause what it is doing and run a specific function. A fault is the same idea for errors, such as reading from an address that doesn't exist.

The STM32 maps the start of flash to address `0x0` when it boots from flash, so the vector table lives at `0x08000000`. In C it can be written as an array of pointers:

```c
__attribute__((section(".isr_vector"), used))
const void *vector_table[] = {
    &_estack,
    Reset_Handler,
    NMI_Handler,
    HardFault_Handler,
};
```

The `section(".isr_vector")` attribute tells the compiler to put the array in its own section so the linker can place it first in flash, and `used` stops the compiler from removing it, since no C code ever reads it. `_estack` is the address of the top of RAM, which comes from the linker script further down.

Dumping the first 8 bytes of the built program gives:

```
08000000: 00200020 15000008
```

The bytes look scrambled because the Cortex-M is little-endian, meaning the least significant byte of a number is stored first. Reading each group of four bytes backwards gives the actual values, `0x20002000` and `0x08000015`. The first is the initial stack pointer, which is the top of the 8 KB of RAM (`0x20000000 + 0x2000`). The second is the reset handler's address, except that `Reset_Handler` is really at `0x08000014`. The extra 1 in the lowest bit tells the CPU to run the code as Thumb instructions, the compact instruction set that a Cortex-M uses. Every handler address in the table has this bit set, and if it were 0 the CPU would fault on its first instruction.

<p align="center">
  <img src="/content/a3/reset_vector.svg"><br>
  <b>Figure 1:</b> What the CPU reads from the vector table at reset. <small>(updated 2026)</small>
</p>

Because the hardware loads the stack pointer before running anything, the reset handler can be an ordinary C function. On many other processors the first instructions have to be written in assembly just to set up the stack.

## Where Variables Live

Here is the program being started:

```c
uint32_t boot_count = 42;
uint32_t ticks;

int main(void)
{
    boot_count++;
    ...
}
```

When the compiler builds this, it sorts everything into sections:

- `.text` holds the machine code for functions.
- `.rodata` holds constants and string literals that never change.
- `.data` holds global and `static` variables that have a non-zero starting value, like `boot_count`.
- `.bss` holds global and `static` variables that start at zero or have no initializer, like `ticks`.

Local variables declared inside a function are in none of these. They live on the stack and only exist while the function runs.

`.text` and `.rodata` can stay in flash, since they never change. `.data` and `.bss` are a problem. `boot_count` changes while the program runs, so it has to be in RAM, but RAM is random at power-on, so the `42` has to be stored in flash and copied into RAM before `main()` runs. The C standard says `ticks` starts at zero, so that part of RAM also has to be cleared before `main()`. Doing those two jobs is most of what the startup code is for.

## The Linker Script

The compiler turns each `.c` file into an object file containing these sections, but without final addresses. The linker then combines all the object files into one program and decides where every section goes. On a computer it uses defaults that suit the operating system. On a microcontroller you give it a linker script describing the chip's memory:

```
MEMORY
{
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 64K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 8K
}

_estack = ORIGIN(RAM) + LENGTH(RAM);

SECTIONS
{
    .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
    .text       : { *(.text*) *(.rodata*) } > FLASH

    _sidata = LOADADDR(.data);
    .data : { _sdata = .; *(.data*); _edata = .; } > RAM AT > FLASH

    .bss  : { _sbss = .; *(.bss*) *(COMMON); _ebss = .; } > RAM
}
```

The `MEMORY` block lists where flash and RAM are and how big they are. In `SECTIONS`, `> FLASH` and `> RAM` say which memory each section goes into, and the vector table is listed first so it ends up at the very start of flash.

On the `.data` line, `> RAM AT > FLASH` gives `.data` two addresses: the address it runs from in RAM, and the address where its initial values are stored in flash. The `.` in the script means the current address, so `_sdata = .;` and `_edata = .;` record where `.data` starts and ends in RAM, and `LOADADDR(.data)` gives the address of its copy in flash. `_sbss` and `_ebss` do the same for `.bss`.

These names are linker symbols. They are not variables. A linker symbol is just an address, so in C they are declared as `extern` and only ever used with `&`:

```c
extern uint32_t _sidata, _sdata, _edata, _sbss, _ebss, _estack;
```

Here `&_sdata` is the address where `.data` starts. Reading `_sdata` itself would read whatever happens to be stored at that address, which is a common first mistake.

The symbol table of the built program shows where everything landed:

| Symbol | Address | Meaning |
|---|---|---|
| `_sidata` | `0x08000078` | where the initial values of `.data` are stored in flash |
| `_sdata` / `boot_count` | `0x20000000` | start of `.data` in RAM |
| `_edata` / `_sbss` | `0x20000004` | end of `.data`, start of `.bss` |
| `ticks` | `0x20000004` | the zero-initialized variable |
| `_ebss` | `0x20000008` | end of `.bss` |
| `_estack` | `0x20002000` | top of RAM, the initial stack pointer |

The value `42` for `boot_count` is stored in flash at `0x08000078`, and the variable itself lives in RAM at `0x20000000`.

<p align="center">
  <img src="/content/a3/memory_map.svg"><br>
  <b>Figure 2:</b> The memory map and the two jobs of the startup code. <small>(updated 2026)</small>
</p>

## The Reset Handler

With those symbols, the reset handler is a short C function:

```c
void Reset_Handler(void)
{
    uint32_t *src = &_sidata;
    uint32_t *dst = &_sdata;

    while (dst < &_edata)
    {
        *dst++ = *src++;
    }

    for (dst = &_sbss; dst < &_ebss; )
    {
        *dst++ = 0;
    }

    main();

    for (;;);
}
```

Firstly, the `while` loop copies `.data` one 32-bit word at a time, reading from flash through `src` and writing to RAM through `dst`, until `dst` reaches the end of `.data`. Secondly, the `for` loop writes zero to every word from the start to the end of `.bss`. Copying a word at a time is safe because vendor linker scripts pad each section to a multiple of 4 bytes with `ALIGN(4)`.

After that, every global variable has its correct starting value, and `main()` can be called. The infinite loop after it is there because there is nothing to return to. On a computer, returning from `main()` hands control back to `_start` and the operating system, which ends the process. On a microcontroller there is nowhere for the CPU to go, so if `main()` ever returns, the program stops here.

The compiler turns this into two small loops of instructions:

```
800002c:  ldr    r4, [r0, r3]     ; load a word from flash into r4
800002e:  str    r4, [r1, r3]     ; store r4 into RAM
8000030:  adds   r3, #4           ; move to the next word
8000032:  cmp    r3, r2           ; reached the end of .data?
8000034:  bne.n  800002c          ; if not, go back
   ...
800004c:  stmia  r3!, {r1}        ; store r1 (zero) and advance r3
800004e:  cmp    r3, r2           ; reached the end of .bss?
8000050:  bne.n  800004c          ; if not, go back
8000052:  bl     800006c <main>   ; call main, return address saved in LR
```

The numbers on the left are the addresses of each instruction in flash, which is what the program counter steps through. `ldr` loads a value from memory into a register, `str` stores one back, and `bne` jumps backwards while the end address hasn't been reached. `stmia` stores a register and moves the pointer forward in one instruction, and `bl` is a function call, which saves the return address in `LR` and loads the address of `main` into `PC`.

A real project normally uses a startup file from the chip vendor instead of writing its own. It does the same two jobs and adds a few more before calling `main()`:

- It sets up the clocks, often in a function called `SystemInit()`. The chip starts on a slow internal oscillator, and the clock speed affects everything else.
- On chips that have a floating point unit, it switches the FPU on. Until then, the first floating point instruction causes a fault.
- It calls `__libc_init_array()`, which runs the constructors of C++ global objects and any function marked `__attribute__((constructor))`.

Putting it all in order, from reset to the first line of `main()` a Cortex-M:

1. Loads the stack pointer from the first word of the vector table.
2. Loads the program counter from the second word and starts running the reset handler.
3. Copies `.data` from flash to RAM.
4. Zeroes `.bss`.
5. Calls `main()`.

If a global has the wrong value at startup on a new board, steps 3 and 4 are where to look. Comparing the linker map file against `_sidata`, `_sdata`, `_edata`, `_sbss` and `_ebss` usually shows which loop is copying or clearing the wrong range.
