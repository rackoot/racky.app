import { ProductSyncFilters } from '@/common/types/syncFilters';
import { VtexCompleteProduct } from '@/marketplaces/services/vtexService';

/**
 * Apply filters to VTEX products
 *
 * Filters products based on active status, categories, and brands.
 * This happens after fetching complete product data from VTEX API.
 *
 * @param products Array of complete VTEX products
 * @param filters Filters to apply
 * @returns Filtered array of products
 */
export function applyVtexFilters(
  products: VtexCompleteProduct[],
  filters: ProductSyncFilters
): VtexCompleteProduct[] {
  console.log(`[VTEX] Applying filters to ${products.length} products`);
  console.log(`[VTEX] Filter criteria:`, JSON.stringify(filters, null, 2));

  let filtered = products;

  // Filter by active status
  filtered = filtered.filter(item => {
    const isActive = item.product.IsActive && item.sku.IsActive;

    if (isActive && filters.includeActive) return true;
    if (!isActive && filters.includeInactive) return true;

    return false;
  });

  console.log(`[VTEX] After active/inactive filter: ${filtered.length} products`);

  // Filter by categories
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    filtered = filtered.filter(item => {
      const productCategoryId = item.product.CategoryId?.toString();

      // Check if product category matches any of the selected categories
      if (productCategoryId && filters.categoryIds!.includes(productCategoryId)) {
        return true;
      }

      // Also check SKU categories
      if (item.sku.Categories && item.sku.Categories.length > 0) {
        return item.sku.Categories.some(catId =>
          filters.categoryIds!.includes(catId.toString())
        );
      }

      return false;
    });

    console.log(`[VTEX] After category filter: ${filtered.length} products`);
  }

  // Filter by brands
  if (filters.brandIds && filters.brandIds.length > 0) {
    filtered = filtered.filter(item => {
      const productBrandId = item.product.BrandId?.toString();
      const skuBrandId = item.sku.BrandId?.toString();

      return (
        (productBrandId && filters.brandIds!.includes(productBrandId)) ||
        (skuBrandId && filters.brandIds!.includes(skuBrandId))
      );
    });

    console.log(`[VTEX] After brand filter: ${filtered.length} products`);
  }

  console.log(`[VTEX] Final filtered count: ${filtered.length} products`);

  return filtered;
}
