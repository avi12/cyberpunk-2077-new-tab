<script lang="ts">
  import { randomQuote } from "@/lib/quotes";

  const { glitching = false }: { glitching?: boolean } = $props();

  const quote = randomQuote();
</script>

<figure class="quote" class:glitch={glitching}>
  <blockquote class="quote__text quote-box quote-hover" class:glitch={glitching} data-text={`"${quote.text}"`}>
    "{quote.text}"
    <span class="quote-glow" aria-hidden="true"></span>
  </blockquote>
  <figcaption class="quote__author hover-glitch" class:glitch={glitching} data-text={`- ${quote.author}`}>
    - <cite>{quote.author}</cite>
  </figcaption>
</figure>

<style>
  .quote {
    max-width: 42rem;
    margin: 0 auto;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .quote__text {
    padding: 0.5rem 1rem;
    color: var(--cp-primary);
    font-family: var(--cp-mono);
    font-style: italic;
    font-size: 1.125rem;
    line-height: 1.75rem;
  }

  .quote__author {
    margin-top: 0.5rem;
    color: var(--cp-accent);
    font-family: var(--cp-mono);

    & cite {
      font-style: normal;
    }
  }

</style>
