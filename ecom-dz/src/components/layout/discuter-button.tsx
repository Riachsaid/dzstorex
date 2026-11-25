'use client';

/**
 * Context-aware "Discuter" handoff.
 *
 * The product identity is passed through SUPPORTED Meta entry-point fields:
 *   - wa.me/<number>?text=...  → pre-filled text carrying `product:<id>`
 *   - m.me/<page>?ref=...      → official Messenger referral `ref`
 *   - website chat webhook     → `productId` + `entryContext` in the POST body
 *
 * Nothing here invents a price, a variant, a stock state or a phone number.
 * Those are always re-read from the authoritative catalog by the agent.
 */
import { useMemo, useState } from 'react';


type Product = {
  id?: string;
  name?: string;
  slug?: string;
  url?: string;
  image?: string;
  variantId?: string;
};

type Props = {
  product?: Product;
  /** Render as an inline button on the product page instead of a floating one. */
  inline?: boolean;
  /** Compact card CTA: one WhatsApp "Discuter" link carrying product context. */
  compact?: boolean;
};

type ChatMessage = { role: 'customer' | 'agent'; text: string };

const TRACKING_KEYS = [
  'ref', 'fbclid', 'post_id', 'postId', 'ad_id', 'adId',
  'campaign_id', 'utm_source', 'utm_campaign', 'utm_content',
] as const;

function referralParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const query = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const key of TRACKING_KEYS) {
    const value = query.get(key);
    if (value) out[key] = value.slice(0, 200);
  }
  return out;
}

function sessionId(): string {
  if (typeof window === 'undefined') return 'dzstorex-server';
  const key = 'dzstorex-chat-session';
  let value = window.localStorage.getItem(key);
  if (!value) {
    value =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, value);
  }
  return value;
}

export function DiscuterButton({ product, inline = false, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  // The layout mounts one generic floating button. On a product page, a CSS
  // `:has()` rule hides it whenever a contextual button is present, so there
  // is exactly one CTA without setState-in-effect side effects.

  const attribution = useMemo(() => {
    const params = referralParams();
    const productToken = product?.id || product?.slug || '';
    const variantToken = product?.variantId ? `variant:${product.variantId}` : '';
    const urlToken = product?.url ? `url:${product.url}` : '';
    const sourceToken = productToken ? 'src:website' : 'src:website-global';
    const extra = Object.entries(params)
      .map(([key, value]) => `${key}:${value}`)
      .join(';');
    return {
      params,
      ref: [productToken ? `product:${productToken}` : '', sourceToken, variantToken, extra]
        .filter(Boolean)
        .join(';'),
      prefilled: [
        `Bonjour DZStoreX, je m'intéresse à ${product?.name || 'vos produits'}.`,
        productToken ? `product:${productToken}` : '',
        urlToken,
        variantToken,
        sourceToken,
        extra,
      ]
        .filter(Boolean)
        .join(' '),
    };
  }, [product?.id, product?.slug, product?.name, product?.url, product?.variantId]);

  // NEXT_PUBLIC_* values are inlined by Next at build time; no server module
  // is imported here, so the client bundle stays free of server-only code.
  const whatsappNumber = (process.env.NEXT_PUBLIC_DZSTOREX_WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(attribution.prefilled)}`
    : '';
  const messengerPageId = process.env.NEXT_PUBLIC_DZSTOREX_MESSENGER_PAGE_ID || '';
  const messengerUrl = messengerPageId
    ? `https://m.me/${encodeURIComponent(messengerPageId)}?ref=${encodeURIComponent(attribution.ref)}`
    : '';
  const chatUrl = process.env.NEXT_PUBLIC_DZSTOREX_CHAT_WEBHOOK_URL || '';
  const hasChannel = Boolean(whatsappUrl || messengerUrl || chatUrl);

  async function send(messagesToSend?: ChatMessage[]) {
    if (!chatUrl || busy) return;
    const text = (input || '').trim();
    if (!text && !messagesToSend) return;
    const next = messagesToSend || [...messages, { role: 'customer' as const, text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId(),
          message: text,
          productId: product?.id || product?.slug || '',
          language: 'darija',
          entryContext: {
            productId: product?.id || '',
            productName: product?.name || '',
            productUrl: product?.url || '',
            productImage: product?.image || '',
            source: 'website',
            referral: attribution.params,
          },
          history: next.map((item) => `${item.role}: ${item.text}`),
        }),
      });
      const data = await response.json();
      const reply = String(data?.reply || data?.output || '').trim();
      if (reply) setMessages([...next, { role: 'agent', text: reply }]);
    } catch {
      setMessages([
        ...next,
        { role: 'agent', text: 'Le chat est indisponible pour le moment. Réessayez plus tard.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!hasChannel) return null;

  // One small, product-aware WhatsApp CTA for catalog cards.
  if (compact) {
    const href = whatsappUrl || messengerUrl;
    if (!href) return null;
    return (
      <a
        href={href}
        data-dzstorex-product-discuter={product ? 'true' : undefined}
        className="relative z-10 mt-2 inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white"
        aria-label={`Discuter sur WhatsApp${product?.name ? ` à propos de ${product.name}` : ''}`}
      >
        Discuter
      </a>
    );
  }

  const chatPanel = open && chatUrl ? (
    <div className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
      <div className="mb-2 max-h-64 space-y-2 overflow-y-auto text-sm">
        {messages.length === 0 ? (
          <p className="text-ink-500">
            {product?.name
              ? `Une question sur ${product.name} ? Écrivez-nous.`
              : 'Bonjour ! Une question sur nos produits ?'}
          </p>
        ) : (
          messages.map((item, index) => (
            <p
              key={index}
              className={
                item.role === 'customer'
                  ? 'ml-auto w-fit rounded-lg bg-brand-50 px-2 py-1'
                  : 'mr-auto w-fit rounded-lg bg-ink-100 px-2 py-1'
              }
            >
              {item.text}
            </p>
          ))
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Votre message"
          className="min-w-0 flex-1 rounded border border-ink-300 px-2 py-1 text-sm"
          placeholder="Écrivez votre message…"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  ) : null;

  const channelLinks = (
    <>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          data-dzstorex-product-discuter={product ? 'true' : undefined}
          className={
            inline
              ? 'inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white'
              : 'rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg'
          }
          aria-label="Discuter sur WhatsApp"
        >
          WhatsApp
        </a>
      ) : null}
      {messengerUrl ? (
        <a
          href={messengerUrl}
          className={
            inline
              ? 'inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white'
              : 'rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg'
          }
          aria-label="Discuter sur Messenger"
        >
          Messenger
        </a>
      ) : null}
      {chatUrl ? (
        <button
          type="button"
          data-dzstorex-product-discuter={product && !whatsappUrl && !messengerUrl ? 'true' : undefined}
          onClick={() => setOpen(!open)}
          className={
            inline
              ? 'inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white'
              : 'rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg'
          }
        >
          {open ? 'Fermer' : 'Discuter'}
        </button>
      ) : null}
    </>
  );

  if (inline) {
    return (
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {channelLinks}
        {chatPanel}
      </div>
    );
  }

  return (
    <div className="dzstorex-global-discuter fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {chatPanel}
      {channelLinks}
    </div>
  );
}

export default DiscuterButton;
