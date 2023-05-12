# W3C Reactivity Protocol Proposal

## Problem



## Purpose

The primary purpose of this repo is to research, experiment, and try to understand whether a general reactivity protocol is feasible, allowing:

  * Model systems to decouple themselves from view engines and reactivity libraries. 
  * View engines to decouple themselves from reactivity libraries.

Achieving this would enable application developers to:

* Swap out their view layers without needing to re-write their models.
* More easily mix multiple view layer technologies together without sync/reliability problems.
* Choose between multiple reactivity implementations, picking the one that has the best performance characteristics based on their application needs. For example, one engine might be faster for initial view rendering, but another might be faster for view updating. Engines could also be selected based on target device. So, a lower memory engine could be used on mobile devices, for example.