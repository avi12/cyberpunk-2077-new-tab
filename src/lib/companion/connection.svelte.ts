import { CompanionState } from "./bridge";

/**
 * Whether the companion can be reached at all, which is one fact about the machine rather than one
 * per card family: journeys and Copilot tips come through the same app, so the setup story is told
 * once, and the retry that ends it runs once.
 */
class Companion {
  /**
   * What the last completed read found. Every section writes it, and they all find the same thing -
   * inside the view transition that redraws the page, so the panel and the rows move together.
   */
  state = $state(CompanionState.loading);

  /** Bumped when there is reason to read again: a permission just granted, or a retry coming round. */
  generation = $state(0);

  refresh() {
    this.generation += 1;
  }
}

export const companion = new Companion();
