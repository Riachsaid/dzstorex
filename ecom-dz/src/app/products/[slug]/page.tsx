import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddToCart } from '@/components/catalog/add-to-cart';
import { ProductGrid } from '@/components/catalog/product-card';
import { DiscuterButton } from '@/components/layout/discuter-button';
import { Badge } from '@/components/ui/badge';
import { getDb } from '@/db/client';
import { getProductBySlug, listProducts } from '@/db/repositories/products';
import { formatMoney, money } from '@/core/money/money';
import { publicEnv } from '@/lib/env';
import { customerPriceC } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(getDb(), slug);
  if (!product) return { title: 'Produit introuvable' };

  return {
    title: product.product.seoTitle ?? product.product.name,
    description:
      product.product.seoDescription ??
      product.product.description?.slice(0, 155) ??
      `${product.product.name} — disponible chez ${publicEnv.siteName}`,
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const db = getDb();
  const entry = await getProductBySlug(db, slug);

  if (!entry || (entry.product.status !== 'active' && entry.product.status !== 'draft')) {
    notFound();
  }

  const { product, availability, variants, stock, category } = entry;
  const related = category
    ? (await listProducts(db, { status: 'active', categorySlug: category.slug, pageSize: 5 })).items.filter(
        (candidate) => candidate.product.id !== product.id,
      )
    : [];
  const freeThreshold = money(publicEnv.freeDeliveryThresholdC);
  const defaultVariant = variants[0] ?? null;

  return (
    <div className="container-page py-8">
      <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-ink-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink-800">
              Accueil
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/products" className="hover:text-ink-800">
              Boutique
            </Link>
          </li>
          {category ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/products?category=${category.slug}`} className="hover:text-ink-800">
                  {category.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink-800">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div
          aria-hidden="true"
          className="grid min-h-64 place-items-center rounded-xl bg-gradient-to-br from-ink-100 to-brand-100 text-ink-300"
        >
          <span className="text-5xl font-black">{product.name.slice(0, 2).toUpperCase()}</span>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge availability={availability.availability}>{availability.labelFr}</Badge>
              {product.brand ? <span className="text-sm text-ink-500">{product.brand}</span> : null}
              {product.status === 'draft' ? <Badge tone="warning">Brouillon (aperçu)</Badge> : null}
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{product.name}</h1>
            {product.nameAr ? <p className="mt-1 text-base text-ink-500" lang="ar" dir="rtl">{product.nameAr}</p> : null}
          </div>

          <AddToCart
            productId={product.id}
            variantId={defaultVariant?.id ?? null}
            name={product.name}
            slug={product.slug}
            unitPriceC={customerPriceC(entry.basePriceC)}
            compareAtPriceC={product.compareAtPriceC}
            maxQuantity={Math.max(1, Math.min(10, stock.available))}
            purchasable={availability.purchasable}
            availabilityLabel={availability.labelFr}
          />

          <DiscuterButton
            inline
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              url: `${publicEnv.siteUrl}/products/${product.slug}`,
              variantId: defaultVariant?.id ?? '',
            }}
          />

          <dl className="grid grid-cols-2 gap-4 border-t border-ink-200 pt-4 text-sm">
            <div>
              <dt className="text-ink-500">SKU</dt>
              <dd className="font-medium text-ink-900">{defaultVariant?.sku ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Disponibilité</dt>
              <dd className="font-medium text-ink-900">
                {stock.available > 0 ? `${stock.available} en stock` : availability.labelFr}
              </dd>
            </div>
            {product.weightGrams ? (
              <div>
                <dt className="text-ink-500">Poids</dt>
                <dd className="font-medium text-ink-900">{(product.weightGrams / 1000).toFixed(2)} kg</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-500">Livraison</dt>
              <dd className="font-medium text-ink-900">58 wilayas</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="mt-10 max-w-prose" aria-labelledby="description-heading">
        <h2 id="description-heading" className="text-lg font-bold text-ink-900">
          Description
        </h2>
        <p className="mt-2 whitespace-pre-line text-ink-700">
          {product.description ?? 'Description en cours de rédaction.'}
        </p>
        {freeThreshold.amount > 0 ? (
          <p className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
            Livraison offerte dès {formatMoney(freeThreshold)} d&apos;achat, sinon les frais sont calculés
            pour votre wilaya avant validation.
          </p>
        ) : null}
      </section>

      {related.length > 0 ? (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-lg font-bold text-ink-900">
            Dans la même catégorie
          </h2>
          <div className="mt-4">
            <ProductGrid products={related} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
