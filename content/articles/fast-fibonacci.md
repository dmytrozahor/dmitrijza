---
title: 'Fibonacci in O(log n): from matrices to fast doubling in Java'
description: 'Why the naive Fibonacci is exponential, how a 2×2 matrix turns it logarithmic, and a fast-doubling BigInteger implementation that computes F(1 000 000) in a fraction of a second.'
date: 2026-10-02
category: mathematics
tags: [algorithms, linear algebra, java]
---

The Fibonacci sequence is defined by

$$
F_0 = 0, \qquad F_1 = 1, \qquad F_{n} = F_{n-1} + F_{n-2}.
$$

The textbook recursive implementation is a classic example of an exponential algorithm: `fib(n)` calls `fib(n-1)` and
`fib(n-2)`, and the call tree has roughly $\varphi^n$ nodes, where $\varphi = \frac{1+\sqrt5}{2} \approx 1.618$.

A loop makes it linear. But we can do much better than linear, and the reason is a small piece of linear algebra.

## The matrix trick

Write two consecutive Fibonacci numbers as a vector. One step of the recurrence is a matrix multiplication:

$$
\begin{pmatrix} F_{n+1} \\ F_n \end{pmatrix}
=
\begin{pmatrix} 1 & 1 \\ 1 & 0 \end{pmatrix}
\begin{pmatrix} F_n \\ F_{n-1} \end{pmatrix}.
$$

Call that matrix $Q$. Applying it $n$ times gives the identity

$$
Q^n = \begin{pmatrix} F_{n+1} & F_n \\ F_n & F_{n-1} \end{pmatrix}, \qquad n \ge 1.
$$

**Proof by induction.** For $n = 1$ it's just $Q$ itself, since $F_2 = 1$, $F_1 = 1$ and $F_0 = 0$. If it holds for
$n$, then

$$
Q^{n+1} = Q^n Q =
\begin{pmatrix} F_{n+1} + F_n & F_{n+1} \\ F_n + F_{n-1} & F_n \end{pmatrix}
=
\begin{pmatrix} F_{n+2} & F_{n+1} \\ F_{n+1} & F_n \end{pmatrix}. \qquad \blacksquare
$$

Matrix powers can be computed by **exponentiation by squaring**: $Q^{2k} = (Q^k)^2$ and $Q^{2k+1} = Q \cdot Q^{2k}$.
That takes $O(\log n)$ matrix multiplications instead of $n$ additions.

## Fast doubling

We can squeeze out more. Squaring $Q^k$ and comparing entries with $Q^{2k}$ gives two identities:

$$
\begin{aligned}
F_{2k}   &= F_k \left( 2F_{k+1} - F_k \right), \\
F_{2k+1} &= F_k^2 + F_{k+1}^2.
\end{aligned}
$$

So from the pair $(F_k, F_{k+1})$ we get $(F_{2k}, F_{2k+1})$ with just three multiplications. If $n$ is odd, one more
addition gives $(F_{2k+1}, F_{2k+2})$. Walking through the bits of $n$ gives the algorithm.

```java
import java.math.BigInteger;

public final class Fibonacci {

    /** Returns {F(n), F(n+1)}. */
    static BigInteger[] pair(long n) {
        if (n == 0) {
            return new BigInteger[] {BigInteger.ZERO, BigInteger.ONE};
        }
        BigInteger[] half = pair(n >>> 1);
        BigInteger a = half[0];                                  // F(k)
        BigInteger b = half[1];                                  // F(k+1)
        BigInteger even = a.multiply(b.shiftLeft(1).subtract(a)); // F(2k)
        BigInteger odd = a.multiply(a).add(b.multiply(b));        // F(2k+1)
        return (n & 1) == 0
                ? new BigInteger[] {even, odd}
                : new BigInteger[] {odd, even.add(odd)};
    }

    public static BigInteger fib(long n) {
        return pair(n)[0];
    }
}
```

The recursion depth is only $\lfloor \log_2 n \rfloor + 1$. Even for $n = 10^{18}$ it is about 60 frames.

## How fast is it, really?

Counting multiplications is only half the story. $F_n$ has about $n \log_{10} \varphi \approx 0.209\,n$ decimal
digits ($\approx 0.694\,n$ bits). $F_{1\,000\,000}$ has 208 988 digits, so the cost is dominated by multiplying *huge*
numbers.

Here the JDK helps: since Java 8, `BigInteger.multiply` switches from schoolbook multiplication to **Karatsuba** and
then **Toom–Cook 3-way** as the operands grow. Both are sub-quadratic. Since Java 19 there's also
`BigInteger.parallelMultiply`, which spreads the large multiplications over the common fork-join pool.

The last multiplications dominate. The final step multiplies numbers with about $n/2$ bits each, and each earlier
level costs about half as much as the next. The total is therefore within a constant factor of a single multiplication
of $n$-bit numbers.

## Why not Binet's formula?

There is a closed form:

$$
F_n = \frac{\varphi^n - \psi^n}{\sqrt5}, \qquad \psi = \frac{1-\sqrt5}{2}.
$$

It's beautiful, but with `double` it only works while $F_n$ fits in the 53-bit mantissa, up to around $n = 70$.
Beyond that you need arbitrary-precision $\sqrt5$, which is more work than the integer method above.

## Takeaways

- **Recurrences are linear maps.** Any linear recurrence of order $k$ can be written as a $k \times k$ matrix and
  raised to a power in $O(\log n)$ steps.
- **Exploit structure.** Fast doubling is the matrix method with the redundant entries removed.
- **Count the real cost.** With big numbers, the size of the operands matters more than the number of operations.

The same idea also gives you $F_n \bmod m$ in $O(\log n)$, which is a staple of competitive programming. Just replace
`BigInteger` with `long` arithmetic modulo $m$.
