import Link from 'next/link';

import { DiscuterButton } from '@/components/layout/discuter-button';

import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { customerPriceC } from '@/lib/pricing';
import type { ProductWithStock } from '@/db/repositories/products';

export function ProductCard({ product }: { product: ProductWithStock }) {
  const { product: row, availability, basePriceC, category } = product;
  // Display price = source (Sawa9ly) price + central margin, resolved server-side.
  const priceC = customerPriceC(basePriceC);
  const discounted = row.compareAtPriceC !== null && row.compareAtPriceC > priceC;

  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div
        aria-hidden="true"
        className="relative grid h-40 place-items-center bg-gradient-to-br from-ink-100 to-brand-100 text-ink-400"
      >
        <span className="text-3xl font-black text-ink-300">{row.name.slice(0, 2).toUpperCase()}</span>
        {discounted ? (
          <span className="absolute left-3 top-3 rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            Promo
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {category ? <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{category.name}</p> : null}
        <h3 className="text-sm font-semibold leading-snug text-ink-900">
          <Link href={`/products/${row.slug}`} className="hover:text-brand-700">
            <span className="absolute inset-0" aria-hidden="true" />
            {row.name}
          </Link>
        </h3>
        <p className="mt-auto flex items-center justify-between gap-2 pt-2">
          <Price amountC={priceC} compareAtC={row.compareAtPriceC} />
        </p>
        <div className="flex items-center justify-between gap-2">
          <Badge availability={availability.availability}>{availability.labelFr}</Badge>
          {row.brand ? <span className="text-xs text-ink-500">{row.brand}</span> : null}
        </div>
        <DiscuterButton
          compact
          product={{
            id: row.id,
            name: row.name,
            slug: row.slug,
            url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dzstorex.leadonhold.com'}/products/${row.slug}`,
            variantId: product.variants[0]?.id ?? '',
          }}
        />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: readonly ProductWithStock[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((entry) => (
        <li key={entry.product.id} className="relative">
          <ProductCard product={entry} />
        </li>
      ))}
    </ul>
  );
}
