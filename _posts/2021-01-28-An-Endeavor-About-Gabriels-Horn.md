---
layout: post
title: "An Endeavor About Gabriel's Horn"
date: 2021-01-28
---

Gabriel's Horn holds a finite amount of paint, yet you could never paint its outside. Evangelista Torricelli first studied it in the 1640s (it is also called Torricelli's Trumpet), and the name comes from the archangel Gabriel's horn. Everything below only needs first-year calculus.

Firstly we need the horn itself. Take the curve $$y = \frac{1}{x}$$, restrict it to $$x \geq 1$$ and rotate it about the x-axis. The result is a long trumpet that keeps getting thinner but never closes off, since $$\frac{1}{x}$$ never reaches zero.

<p align="center">
  <img src="/content/a0/horn.png"><br>
  <b>Figure 1:</b> Gabriel's Horn from x = 1 to 10. <small>(updated 2026)</small>
</p>

Since the horn is infinitely long we can't integrate all the way out right away. Instead we cut it off at some arbitrary $$x = a$$, do the math, and then let $$a$$ go to infinity.

Using the disk method, every slice of the horn is a circle with a radius of $$\frac{1}{x}$$, so each slice has an area of $$\pi\left(\frac{1}{x}\right)^2$$. Adding up all of those slices from $$1$$ to $$a$$ gives:

$$
\begin{aligned}
V(a) &= \pi \int_1^a \left(\frac{1}{x}\right)^2 dx \\
&= \pi \left[-\frac{1}{x}\right]_1^a \\
&= \pi\left(1 - \frac{1}{a}\right)
\end{aligned}
$$

Now letting the horn go on forever $$\dots$$

$$\boxed{\lim_{a\to\infty} V(a) = \pi}$$

$$\dots$$ the volume converges to $$\pi$$ cubic units.

The surface area of a solid of revolution is given by:

$$A = 2\pi \int_1^a f(x)\sqrt{1 + \big(f'(x)\big)^2}\, dx$$

With $$f(x) = \frac{1}{x}$$ and $$f'(x) = -\frac{1}{x^2}$$ we get:

$$A(a) = 2\pi \int_1^a \frac{1}{x}\sqrt{1 + \frac{1}{x^4}}\, dx$$

This integral is not very pleasant to solve directly, but we only need a lower bound. Since $$\sqrt{1 + \frac{1}{x^4}} > 1$$ for every $$x$$, the integrand is always bigger than $$\frac{1}{x}$$. Therefore:

$$
\begin{aligned}
A(a) &> 2\pi \int_1^a \frac{1}{x}\, dx \\
&= 2\pi \ln(a)
\end{aligned}
$$

And since $$\ln(a)$$ grows without any bound $$\dots$$

$$\boxed{\lim_{a\to\infty} A(a) = \infty}$$

$$\dots$$ the surface area is infinite, even though it grows very slowly.

Figure 2 plots both against the length of the horn. The volume levels off at $$\pi$$ after only a few units of length, while the surface area keeps climbing. On a log axis the area is close to a straight line, since it grows like $$\ln(a)$$.

<p align="center">
  <img src="/content/a0/volume_vs_area.png"><br>
  <b>Figure 2:</b> Volume vs. surface area. <small>(updated 2026)</small>
</p>

A few values computed numerically:

| Length $$a$$ | Volume $$V(a)$$ | Surface area $$A(a)$$ |
|---|---|---|
| 10 | 2.83 | 15.18 |
| 100 | 3.11 | 29.65 |
| 1,000 | 3.14 | 44.11 |
| 1,000,000 | 3.14 | 87.52 |

Going from a length of 1,000 to 1,000,000 doesn't change the volume to two decimal places, while the surface area almost doubles.

Essentially what this means is that one could easily fill the horn with paint, $$\pi$$ units of it to be exact, but it would take an infinite amount of paint to cover the outside surface. Filling the horn would also coat the inside walls, which have the same infinite area, so the two results seem to contradict each other.

The way out is that real paint has a thickness. Far enough down the horn the opening becomes narrower than a single molecule of paint, so the paint can't follow it all the way. The mathematical horn has walls with zero thickness, and a layer of paint that keeps getting thinner can cover an infinite area with a finite volume. So the contradiction only comes from assuming that a finite volume always means a finite surface area, which this shape shows isn't true.
