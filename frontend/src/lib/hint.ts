import { fetchWikipediaSummary } from "./wikipediaSummary";
import { fetchImageUrl } from "./images";

export type HintDetails = {
  text: string | null;
  imageUrl: string | null;
};

export async function fetchHintDetails(term: string): Promise<HintDetails> {
  const summary = await fetchWikipediaSummary(term);
  // The article's own thumbnail is reliable; only fall back to a Commons
  // keyword search (less reliable, but better than nothing) if the term
  // didn't resolve to a Wikipedia article with its own image.
  const imageUrl = summary.thumbnailUrl ?? (await fetchImageUrl(term));
  return { text: summary.extract, imageUrl };
}
