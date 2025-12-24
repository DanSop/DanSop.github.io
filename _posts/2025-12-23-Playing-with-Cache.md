---
layout: post
title: "Playing with My Cache"
date: 2025-12-23
tags: [markdown, latex, code]
---

 A general note since this is the first article posted... these articles are meant to be more of a "blog-style" read. That is, they won't have the formality of a research paper and will be much more casual. The topics will (for the most part) still be technical in nature, and each post will be written entirely by myself, a genuine, living, human author. Since I am STEM brained individual please read at your own discretion.

This article dives into several memory optimization techniques that I've picked up or have seen from working on several projects. The following are the topics that I found interesting and associated with cache/memory optimization and usage. The applications will focus on more resource-constrained systems such as embedded systems, but both examples will likely be provided (if I get around to doing both).

- True and False Sharing
- Padding
- Cache Invalidation vs Write-Back
- Hot/Cold Data

## True and False Sharing

**False sharing** is a term associated with a specific type of performance bottleneck in modern parallel programming. It will occur when two (or more) processors inadvertently fight or attempt to access the same single piece of hardware memory. For our case we will focus on the hardware memory being a cache line. But first! Some extremely simplified and very generic background information on how a CPU typically talks to RAM and its association with the cache line.

When a CPU needs to read some data from the memory, it is typically done in the smallest fixed-size unit possible (typically 64 bytes). Instead of fetching individual bytes of memory from a slower external RAM or shared RAM, the processor will bring in this entire line containing the requested data to a faster local memory region. The idea is simple, fetching one byte at a time would be slow, so instead let's just snag up the whole block and store it nearby. This block of data is what we call a cache line.

<p align="center">
  <img src="/content/a1/a1_p1.svg" alt="Picture of a CPU/Cache setup.">
</p>

Note that for the diagram I showed the L1 and the L2 cache being localized to the core and L3 being shared. This is a fairly typical setup for modern day architectures but it is still a generic example. We can have false/true sharing between the L1 cache and L3 cache, L2 cache and L3 cache, and even L(x) cache (as long as it is localized to the core) and any external RAM that is added to the system.

Here is where the fun term "**Cache Coherency**" comes into play. This term will be used a lot so lets define it as a way of keeping data consistent across multiple cores and hence multiple threads/tasks. Each core has its own cache controller that manages this and it is entirely hardware driven (spoiler it is not, see cache cleaning for more on this).

Now lets get back to that whole false sharing idea. If two cores need the same data, say *X*, when core 0 updates *X* in the external region of memory, core 1 must be notified so that its cache is updated to the new value (that whole cache coherency thing). Believe it or not this is called "**True Sharing**" as this is an intended implementation of the data as it is meant to be shared.

False sharing on the other hand is the exact... same... thing? Now rather than my awful term "thing" let us describe this process as a mechanism. An unwanted application of this mechanism is when both cores end up working with different variables that just happen to sit on the same cache line; that whole damn cache coherency thingy treats the entire line as one unit, therefore when core 0 updates its variable/data, core 1's cache line is invalidated or becomes stale even though it does not need the data that core 0 is updating. This means that poor ole core 1 has to fetch the cache line from the shared memory again wasting precious cycles and bandwidth.

Let me reiterate this, the hardware is doing exactly what it's supposed to do, but in this specific case it's unintentional and causes a pretty big performance hit. A lovely diagram of the cache line being shared is shown below:

<p align="center">
  <img src="/content/a1/a1_p2.svg" alt="Picture of a Cache Line.">
</p>

To quickly summarize, **False Sharing** is when two or more cores are working on independent variables or data that is stored on the same cache line. Each separate core will invalidate the cache line when the data is changed, therefore the respective core that did not update its own variable and invalidate the cache will be forced to fetch this cache line again if it wants to operate on its own variable. More fetches = slower execution  = slop.

Now that is cool and all; lots of talking about RAM and cache and fun things, but lets see some real examples of **True and False Sharing**.

###### Linux/GCC False Sharing Example

These examples were compiled using GCC and were intentionally simple. This program will spawn two threads that access data in a structure. For the first example we will show **False Sharing**:

- **Example 1:**

```c
#include <pthread.h>
#include <stdio.h>
#include <stdint.h>

#define ITERATIONS 10000000

typedef struct 
{ 
  uint64_t value; 
  uint32_t id; 
} Data;

struct 
{
  Data d1;
  Data d2;
} cache_line = { 0 };  

void * thread1(void * arg)
{
  for(int i=0; i<ITERATIONS; i++) 
  {
    cache_line.d1.value++;
    cache_line.d1.id=i;
  }
  return NULL;
}

void * thread2(void * arg) 
{
  for(int i=0; i<ITERATIONS; i++)
  {
    cache_line.d2.value++;
    cache_line.d2.id=i;
  }
  return NULL;
}

int main() 
{
  pthread_t t1,t2;
  pthread_create(&t1,NULL,thread1,NULL);
  pthread_create(&t2,NULL,thread2,NULL);
  pthread_join(t1,NULL);
  pthread_join(t2,NULL);
}
```

For the example above the two threads are accessing the same data structure 'cache_line' therefore there will be false sharing as both threads are trying to access the same variable. 

Now for the example without false sharing, all we do is simply change the cache_line structure's data to be 64 byte aligned to force separate cache lines, resulting in no false sharing. To do this, we will use the compiler attribute `__attribute__((aligned(64))` that tells the compiler to place the variable at a memory address that's a multiple of 64 bytes. Therefore we change the following code:

```c
// rest of the program above...
struct 
{
  Data d1 __attribute__((aligned(64)));
  Data d2 __attribute__((aligned(64)));
} cache_line = { 0 };
// rest of the program below...
```

 The result after compiling the applications and using `time` for both applications is the following:

```bash
(base) danny@linux:$ time ./no_sharing 
real    0m0.017s
user    0m0.032s
sys     0m0.000s
(base) danny@linux:$ time ./false_sharing 
real    0m0.038s
user    0m0.061s
sys     0m0.004s
```

Right away we can see the functionality of both programs are the same, but since one has the data structures aligned on 64 byte memory addresses this allows the local core specific cache to never be invalidated by another core, thus we see up to a ~50% performance increase in running this application as no false sharing is taking place.

We can also look at the cache misses themselves through the usage of `perf` on Linux, resulting in the following information:

```bash
(base) danny@linux:$ sudo perf stat -e cache-references,cache-misses,L1-dcache-load-misses ./no_sharing

55,489       cpu_core/cache-references/
 8,375       cpu_core/cache-misses/
13,682       cpu_core/L1-dcache-load-misses/

(base) danny@linux:$ sudo perf stat -e cache-references,cache-misses,L1-dcache-load-misses ./false_sharing

858,174      cpu_core/cache-references/
  9,168      cpu_core/cache-misses/
363,549      cpu_core/L1-dcache-load-misses/
```

This tells us more information about the performance impact on false sharing as it has nearly 17x more cache references and 33x more L1 cache misses. Mainly the important part here is the performance impact on the overall time, that is a direct result of the performance impact on the L1 data cache misses, as each thread is invalidating the other's cache; the CPU is putting in overtime as it is constantly reloading the cache line from the L2/L3 cache (whichever is shared between the cores).

## Padding

Great, you discovered false sharing is the bane of your existence and it is causing you major performance issues. I've already shown you once solution by using compiler atrributes to ensure data structures are 64 byte aligned, but there is also another common practice I have seen to fix this issue. This next section, **padding**, is the other common practice to fix false sharing.

I want to put a note here that I recommend using the compiler attribute for aligning memory rather than padding, as they are functionally the same but padding could potentially become unreadable for a future developer.

This becomes explicitly clear when we modify example 1 to using padding rather than alignment:

```c
// rests of the program above...
typedef struct 
{ 
  uint64_t value; 
  uint32_t id; 
  char wasted_bytes[52]; // padding :)
} Data;
// rest of the program below...
```

If we change the `Data` structure definition to use padding we get the same performance increase as no false sharing is happening anymore. This is because the 52 byte padding after the first two variables ensures the entire structure is 64 bytes, meaning that two of these structures cannot exist on the same cache line at the same time. 

This manual padding works, but it looks fairly gross and comes with some potential issues down the line. First of all we are wasting bytes by adding padding (not that aligning is any better in this aspect). It should be noted that these bytes could be replaced with data in the future. I refer to padding as "I know what I am doing" approach, since you have to manually calculate each individual element and add all the bytes together to know how much padding to add. 

This is fine for my simple example, but can you imagine doing this for 10+ structures with a massive amount of elements containing other structures? This calculation starts to be cumbersome and furthermore if any variable is added to this structure in the future the padding has to be recalculated. The math gets annoying fast and your coworkers might yell at you if they have to pull out a calculator everytime they want to add an element to a structure.

The upside of padding? It's bulletproof portable. Padding works on literally every C compiler ever made. MSVC, GCC, Clang, some ancient Mesopotamian compiler, yup, padding will work. Nonetheless I still recommend using the compiler attributes for a modern approach.

<p align="center">
  <img src="/content/a1/a1_p3.svg" alt="Picture of a padding vs attribute.">
</p>

## Cache Invalidation vs Write-Back

Let's get this straight, caches exist to cheat by letting the CPU pretend memory is fast, local, and exclusive. This facade crumbles by a simple touch of the memory by any other peripheral.

The only way to restore reality for this CPU is to use two blunt tools provided by software:

- Write-Back (clean)
- Invalidation

These are not optimizations, they are correctness mechanisms and getting them wrong produces bugs that ignore most debuggers and will likely disappear under logging. Only reappearing at the worst possible time. We must understand why these operations exist in the first place, and how they are related to cache.

#### Two Fundamental Cache Issues

All cache bugs or issues are reduced to one of the following:

1) The memory is newer than the cache
2) The cache is newer than the memory

We first look at the case where the cache is newer than the memory. A write-back forces the dirty cache lines to be written to main memory without them being cleared from the cache. Why is this needed you may ask? Well I am going to answer this from the perspective of a DMA (direct memory access controller).

A DMA allows data to flow from a peripheral directly into memory (or vice versa) while ignoring the CPU. We can think of the flow as going from Disk -> RAM rather than Disk -> CPU -> RAM. We can think of the DMA being "blind" to the CPU's cache, which creates two major risks that require cleaning and invalidation.

<p align="center">
  <img src="/content/a1/a1_p4.svg" alt="Picture of a generic DMA setup.">
</p>

Imagine core 0 has a piece of data in its L1 cache. Meanwhile, a DMA controller writes a new version of data directly into the main memory. Core 0 does not know that the memory has changed externally and keeps its old and stale cached version. Therefore to fix this, the system must invalidate that cache line so the CPU is forced to fetch the new data from RAM.

Now if we look at this problem from a different angle, if the CPU has modified data in its cache but has not written it back to RAM yet, then the DMA controller tries to read that data from RAM to send it to a disk or elsewhere but it is reading old data. Therefore the CPU must flush (write-back) its cache to RAM before the DMA starts its job.

You may be wondering, well what the hell when we looked at false sharing those cores had cache coherency that automatically performed the L1 cache hits and automatically updated data for the cores (at a cost of performance of course). So why are we having to do this invalidation and write-back manually now? 

To answer this as generically as possible, it comes down to **Cache Coherency**... the gift that keeps giving. Cache coherency does not mean, "memory always updates itself everywhere to the newest version", a better explanation is:

> Cache coherency relies on participants to agree on the value of a cache line when they talk through a coherency fabric

Coherency is a protocol controlled by the cache controller; a DMA engine does not have a cache controller therefore it cannot participate in cache coherence and therefore its writes go unnoticed by the CPU caches (hence when software has to be involved). From the definition it should be noted that coherency fabric is the hardware network that lets the cache controllers maintain themselves and other caches.

You must always ensure that your data is not stale if using systems that are not connected directly to your cache controller; flushing (Write-back) and cleaning (invalidation) mechanisms must be used.
## Hot/Cold Data

Another interesting topic relating to cache is managing hot and cold data. Just like how your morning coffee is better hot and your Blue Ocean on a sunny day is better cold, different types of data belong in different places based on how often they are used.

Therefore we must develop and understand the relationship between this hot data, cold data, and its relevance to the cache to build systems that are lightning fast.

We define "Hot Data" as the active working set of data that holds information being accessed and modified right now. Ideally, this data must live in the cache or another high performance memory location

We define "Cold Data" as information you rarely visit or look at but the data still must exist. Ideally, this data lives in a slow storage location as it is not needed.

We note that we can have both hot data and cold data in the same structure and hence problems arise regarding the cache. A single hot field or variables can drag its cold neighbors into the cache or a cold field could evict unrelated hot data. Essentially if hot and cold data live in the same cache line, the cache treats them equally even if the software does not. 

So what is a common way to ensure the hot and cold data remain separated at the cache level? Well the simplest and highest impact optimization is to perform hot/cold splitting. Now this can look different depending on your scenario. For example, say you are using a complex library with a massive stack that is made up of individual blocks of memory that you can allocate anywhere in your system. You may choose to allocate the "hottest" or most used portions of this stack to the faster regions of memory available to you. 

For a much simpler example say we have the following structure:

```c
typedef struct 
{
  int coffee;       // hot
  float fire, lava; // hot
  char winter[32];  // cold
  int snow;         // cold
} object;
```

We know this structure is made up of hot and cold aspects, therefore we can perform a super simple hot/cold splitting of the data:

```c
// Fast cache please
typedef struct 
{
  int coffee;       // hot
  float fire, lava; // hot
} hot_object;

// I do not care where I am placed
typedef struct 
{
  char winter[32];  // cold
  int snow;         // cold
} cold_object;
```

For this example, we would want to ensure that the hot data object is placed in the fastest cache possible. We can think of cache from the hot/cold perspective as "hot data VIP lounge" as this cache space is very expensive and limited therefore only the hottest data can get it. This also relates to another topic called "Cold Start" where when a system first starts the cache is empty therefore all requests for hot data result in cache misses, forcing the system to go all the way back to cold data (you can also pre-heat the cache so that it does not have misses on startup).  

Remember, always to play with your cache.
