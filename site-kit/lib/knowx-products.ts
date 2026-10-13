/** A site with more than one top-level help category shows product cards. */
export function useProductLayer(count: number): boolean {
	return count > 1;
}
