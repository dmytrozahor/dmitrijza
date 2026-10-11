---
title: 'Proofs nobody understands: Terence Tao, AI and the purpose of mathematics'
description: 'What Terence Tao has actually said and done about AI in mathematics, and why I think the real test for AI companies is whether humans can still understand the mathematics their models produce.'
date: 2026-10-11
category: mathematics
tags: [ai, mathematics, proof, lean, formalization]
illustration: math
---

In 2023, Terence Tao made a prediction that sounded bold at the time. In a short essay for Microsoft's AI anthology,
[_Embracing change and resetting expectations_](https://unlocked.microsoft.com/ai-anthology/terence-tao/), he wrote
that when combined with formal proof verifiers, search and symbolic math packages, "2026-level AI, when used properly,
will be a trustworthy co-author in mathematical research".

It is now 2026, and the prediction looks less like a guess and more like a description. Language models have found
new proofs of small open problems, formal verification has moved from niche to normal, and the International Congress
of Mathematicians in Philadelphia had a public lecture on exactly this topic. The question is no longer _whether_ AI
can do mathematics. The question is what mathematics is _for_ once it can.

That is the question I want to follow here: first through what Tao has said and done, and then towards my own
position.

## Why the question matters now

For most of history, producing a proof and understanding it came bundled together. A human wrote the proof, so at
least one human understood it, and usually the act of writing it was the act of understanding it. Referees, seminars
and textbooks then spread that understanding to others.

AI breaks the bundle. A model can produce an argument that no person has thought through, and a proof assistant can
certify that argument without anyone reading it. Both are genuinely useful. Together, they make it possible, for the
first time, to grow mathematics faster than mathematicians can absorb it.

Tao put the risk plainly in his ICM 2026 lecture, as reported by the
[Simons Foundation](https://www.simonsfoundation.org/2026/08/13/fields-medalist-terence-tao-on-artificial-intelligence-and-why-we-do-math/):

<blockquote class="pull">

“We can have these 100,000-line proofs that we have to verify, but no one understands them.”

<cite>Terence Tao, “Mathematics in the Age of AI”, ICM 2026</cite>
</blockquote>

## Who Terence Tao is, briefly

Tao is a professor at UCLA and received the Fields Medal in 2006. He works across harmonic analysis, PDE,
combinatorics and number theory, which makes him unusually well placed to judge tools that claim to help "mathematics"
in general rather than one niche.

He is also unusually public. His [blog](https://terrytao.wordpress.com/) and his
[Mathstodon account](https://mathstodon.xyz/@tao) are a running lab notebook of his experiments with AI tools and
proof assistants. That matters for this article: almost everything below can be traced to something he wrote or said
on the record, not to rumours about him. He has also been an advisor to the
[AI for Math Fund](https://www.renaissancephilanthropy.org/insights/renaissance-philanthropy-and-xtx-markets-launch-new-9-million-ai-for-math-fund-l5z5f)
launched by Renaissance Philanthropy and XTX Markets in December 2024, which funds open tools, datasets and
field-building for AI in mathematics.

## AI as a collaborator, not an oracle

Tao's view of AI tools has shifted with the tools themselves, but the frame has stayed the same: AI is an assistant
whose output a mathematician supervises.

In September 2024, after testing OpenAI's o1 model, he
[described the experience](https://mathstodon.xyz/@tao/113132502735585408) as roughly like advising a "mediocre, but
not completely incompetent" graduate student: it could reach correct solutions with hints, but did not supply the key
conceptual ideas itself. By March 2026, at an IPAM conference, he was
[reported by OpenAI Academy](https://academy.openai.com/en/public/blogs/terence-tao-ai-is-ready-for-primetime-in-math-and-theoretical-physics-2026-03-06)
as saying that AI now "saves more time than it wastes" in mathematics and theoretical physics, and that cheaper
exploration lets him try "crazier things".

The clearest concrete case is the Erdős problems. In January 2026 Tao
[reported](https://mathstodon.xyz/@tao/115855845720777387) that Erdős problem #728 had been solved "more or less
autonomously" by an AI model after some initial feedback, with the proof then formalized in Lean. But he paired the
news with caveats: problems on that list vary enormously in difficulty, some "open" problems turn out to be solved in
the literature already, and failures are rarely reported. The
[wiki he helped maintain](https://github.com/teorth/erdosproblems/wiki/AI-contributions-to-Erd%C5%91s-problems)
on AI contributions states bluntly: "This page is not a benchmark", and asks readers to "Keep selection bias in mind".

That caution about reporting is a consistent theme. During the 2025 IMO, when AI labs announced gold-medal-level
results, Tao [wrote](https://mathstodon.xyz/@tao/114881418225852441) that "It is tempting to view the capability of
current AI technology as a singular quantity", and then walked through how extra time, tools, hints, multiple attempts
or silent withdrawal would each change the difficulty of the contest. His point was not that the results were fake. It
was that a score means little unless the conditions behind it are disclosed.

## Lean: trust without understanding?

The other half of Tao's work on this topic is formalization. A proof assistant like
[Lean](https://lean-lang.org/) checks every step of a proof mechanically. If the formal proof compiles, you can trust
the result even if you never read it.

<div class="callout definition" data-label="Definition · Formal proof">

A **formal proof** is a derivation written in a language precise enough that a small, trusted program (the kernel of a
proof assistant) can check every inference. Correctness no longer depends on a referee's attention, only on the kernel
and on the statement being formalized correctly.

</div>

Tao has used this at scale. After he, Tim Gowers, Ben Green and Freddie Manners proved the Polynomial
Freiman–Ruzsa conjecture in November 2023, he led a
[Lean formalization of the proof](https://terrytao.wordpress.com/2023/11/18/formalizing-the-proof-of-pfr-in-lean4-using-blueprint-a-short-tour/)
that reached its main goal in about three weeks, organized around a human-readable "blueprint" whose dependency graph
showed which lemmas were done. In 2024 he launched the
[Equational Theories Project](https://arxiv.org/abs/2512.07087), which determined all 22,028,942 implications between
4694 simple algebraic laws for magmas, mixing human proofs, automated theorem provers and Lean.

Notice the design in both projects. The machines did the checking and much of the grinding, but the work was organized
around a document that humans could read. The blueprint is not decoration; it is how a crowd of contributors who had
never met could understand what they were building.

This is also why Tao's 2023 prediction mentioned formal verifiers alongside language models. LLMs are fluent and
unreliable; proof assistants are reliable and unforgiving. Combined, they can produce mathematics you can trust. But
trust is not the same thing as understanding, and formalization alone does not close that gap.

## The old warning: Thurston and the four colour theorem

None of this is new in principle. Mathematicians have argued about proofs nobody could fully survey for fifty years.

<ol class="timeline">
<li><strong>1976</strong> Appel and Haken prove the four colour theorem with a massive computer case analysis. The proof is accepted, but controversial.</li>
<li><strong>1994</strong> William Thurston publishes <a href="https://arxiv.org/abs/math/9404236"><em>On Proof and Progress in Mathematics</em></a>.</li>
<li><strong>1998</strong> Thomas Hales announces a computer-assisted proof of the Kepler conjecture; years later, the referees report being only <a href="https://experimentalmath.info/blog/2014/08/formal-proof-completed-for-keplers-conjecture-on-sphere-packing/">"99% certain"</a> of it.</li>
<li><strong>2014</strong> The Flyspeck project completes a <a href="https://arxiv.org/abs/1501.02155">formal proof of the Kepler conjecture</a> in HOL Light and Isabelle.</li>
<li><strong>2026</strong> Tao's ICM lecture asks what mathematics is for once proofs can be automated.</li>
</ol>

Thurston's essay is the classic statement of the problem. He argued that the right question is not how
mathematicians prove theorems, but "How do mathematicians advance human understanding of mathematics?" About the four
colour theorem, he wrote that the controversy had little to do with doubts about its truth; rather, "it reflected a
continuing desire for human understanding of a proof, in addition to knowledge that the theorem is true." He even
anticipated our moment: "The rapid advance of computers has helped dramatize this point, because computers and people
are very different."

Flyspeck shows both sides. Formal verification resolved the _doubt_ about Kepler. It did not, by itself, make the
proof easier to understand. Those are two different achievements, and AI is about to make the first one cheap.

## What Tao thinks mathematics is for

Tao has been thinking about this since long before LLMs. His 2007 essay
[_What is good mathematics?_](https://arxiv.org/abs/math/0702396) lists many qualities of good mathematics,
including problem-solving, technique, theory, insight and exposition, and argues that the very best examples are
"part of a greater mathematical story, which then unfurls to generate many further pieces of good mathematics".

In his ICM 2026 lecture he applied that pluralism to AI. According to the
[Simons Foundation report](https://www.simonsfoundation.org/2026/08/13/fields-medalist-terence-tao-on-artificial-intelligence-and-why-we-do-math/),
he said: "It is not enough to generate and verify the proofs. The proofs need to be explained well enough that they
can be communicated and understood by the community." He noted that mathematics used to let "the outcomes speak for
themselves", which "worked until we figured out a way to automate outcomes without process", and that current tools
are "very opaque about their process". The
[_Plus_ magazine summary](https://plus.maths.org/icm-2026-postcard-philadelphia) of the same lecture adds his
suggestion that the community may want to value verifying, writing up and absorbing results more than merely finding
them, because getting a result into the body of knowledge that later generations learn is the least automatable and
most valuable step.

His conclusion was about agency: "We set the rules on what's acceptable or not, and we should not let external actors
define those for us."

## My thesis: mathematics must stay understandable

Here is where I stop reporting and start arguing.

I believe **mathematics should stay understandable for humans**, and that this is not nostalgia but a functional
requirement. Three reasons.

1. **Understanding is what transfers.** A verified theorem is a fact. An understood theorem is a technique. The ideas
   inside a proof are what let someone prove the next theorem, in a different field, decades later. A proof that
   nobody understands is a dead end, even if it is correct.
2. **Understanding is how we choose what to prove.** Machines can now search; humans still decide which questions are
   worth asking. That judgement is built from understanding existing mathematics. If we stop understanding, we lose
   the ability to steer.
3. **Understanding is the point.** I do mathematics for the same reason I enjoy a clean piece of code: not because
   it compiles, but because I can see why it works. A mathematics that only machines read would be a strange
   inheritance to leave the next generation.

None of this means rejecting AI. It means treating human understanding as the success metric, and treating a proof that
nobody can explain as unfinished work rather than a finished result.

## What AI companies should do

Tao says mathematicians should set the rules. I agree, but the companies building these systems choose what they
optimize for, and right now the easy metric is "solved or not". Here is what I think a responsible AI lab should take
into account.

- **Ship explanations, not just proofs.** Every formal proof a model produces should come with a human-readable
  account: the key idea, the strategy, the lemmas that matter. The PFR blueprint is a good template. A Lean file proves
  the statement; the blueprint lets people learn from it.
- **Optimize for understanding, not just correctness.** Shorter, more conceptual proofs should be rewarded over
  brute-force ones. If a model finds a 100,000-line proof, a second goal should be to find a 10-page one.
- **Report results honestly.** Disclose compute, time limits, number of attempts, human hints, tool access and
  failures. Tao's IMO post is effectively a checklist for this. Anything less makes progress impossible to judge.
- **Feed the commons.** Contribute to open formal libraries like
  [Mathlib](https://github.com/leanprover-community/mathlib4) and release datasets, so that verification infrastructure
  belongs to the mathematical community rather than to one vendor.
- **Credit and fund the humans.** AI results stand on decades of human-written literature and on mathematicians who
  check, formalize and explain them. That work should be credited in papers and supported with money, as initiatives
  like the AI for Math Fund already try to do.
- **Build tools that teach.** The best assistant is one that leaves its user more capable: explaining a step on request,
  pointing to the relevant literature, letting a student explore. A tool that only hands out answers trains people to
  stop understanding.
- **Let mathematicians set the norms.** On authorship, disclosure and what counts as a result, labs should follow the
  community's lead rather than define success through press releases.

<div class="callout theorem" data-label="Principle · A proof is finished when it is understood">

A result produced with AI should count as complete only when at least one human can explain why it is true, and that
explanation is written down for others. Verification establishes truth; explanation turns truth into mathematics.

</div>

## Closing

Tao's predicted "trustworthy co-author" has more or less arrived. He has spent the last few years showing what that
co-author is good for: exploring cheaply, grinding through cases, formalizing at scale. He has also spent them warning
about what it cannot replace: honest reporting, community norms and, above all, understanding.

Thurston asked how mathematicians advance human understanding. The arrival of capable AI does not make that question
obsolete. It makes it the only question left that machines cannot answer for us. Mathematics should stay something
people can understand, and the companies building these tools should treat that as a design requirement, not an
afterthought.
