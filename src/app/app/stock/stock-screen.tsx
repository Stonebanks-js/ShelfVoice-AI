"use client";

import { Camera, Minus, Mic, Package, PackageX, Plus, SearchX, Trash2, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Chip, Switch } from "@/components/ui/controls";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { SearchField, TextField } from "@/components/ui/field";
import { IconTile } from "@/components/ui/list";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import { categories, matches, type StockProduct } from "@/lib/stock";

const OUT = "__out__"; // the "Out of stock" chip

export function StockScreen({ initial }: { initial: StockProduct[] }) {
  const { t } = useLang();
  const toast = useToast();
  const [products, setProducts] = useState(initial);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [editing, setEditing] = useState<StockProduct | "new" | null>(null);

  const other = t("stock.other");
  const chips = useMemo(() => categories(products, other), [products, other]);
  const shown = products.filter(
    (p) => matches(p, query) && (chip === null || (chip === OUT ? !p.is_in_stock : (p.category ?? other) === chip)),
  );
  // Grouped by category, in the chips' order.
  const groups = chips.map((name) => ({ name, items: shown.filter((p) => (p.category ?? other) === name) })).filter((g) => g.items.length);

  async function reload() {
    const { products: fresh } = await api<{ products: StockProduct[] }>("/api/v1/products");
    setProducts(fresh);
  }

  // Doc 06: the switch flips at once; a failure flips it back with a reason.
  async function setInStock(product: StockProduct, inStock: boolean) {
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, is_in_stock: inStock } : p)));
    try {
      await api(`/api/v1/products/${product.id}`, { method: "PATCH", json: { is_in_stock: inStock } });
    } catch (failure) {
      setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, is_in_stock: !inStock } : p)));
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  // Close the sheet before the list reloads: adding the first product swaps
  // the empty screen for the list, which would otherwise reopen it blank.
  const saved = async (message: string) => {
    setEditing(null);
    toast.show({ message });
    await reload();
  };

  if (products.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader title={t("tab.stock")} trailing={<AddButton onClick={() => setEditing("new")} />} />
        <div className="px-4">
          <EmptyState
            icon={<Package />}
            title={t("stock.empty.title")}
            body={t("stock.empty.body")}
            action={
              <ButtonLink href="/app/setup" size="lg" icon={<Mic aria-hidden className="size-5" />}>
                {t("stock.empty.cta")}
              </ButtonLink>
            }
          />
        </div>
        {editing && <ProductSheet product={editing} onClose={() => setEditing(null)} onSaved={saved} />}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("tab.stock")} subtitle={t("stock.total", { n: products.length })} trailing={<AddButton onClick={() => setEditing("new")} />} />
      <div className="flex flex-col gap-3 px-4">
        <SearchField label={t("search.placeholder")} clearLabel={t("search.clear")} value={query} onValueChange={setQuery} />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
          <Chip selected={chip === null} onClick={() => setChip(null)}>
            {t("stock.all")}
          </Chip>
          <Chip selected={chip === OUT} onClick={() => setChip(chip === OUT ? null : OUT)}>
            {t("status.outOfStock")}
          </Chip>
          {chips.map((name) => (
            <Chip key={name} selected={chip === name} onClick={() => setChip(chip === name ? null : name)}>
              {name}
            </Chip>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="px-4">
          <EmptyState icon={<SearchX />} title={t("stock.noMatch", { q: query || t("status.outOfStock") })} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-4 pb-4">
          {groups.map((group) => (
            <section key={group.name} className="flex flex-col gap-1.5">
              <h2 className="px-4 text-footnote font-medium text-ink-2">{group.name}</h2>
              <ul className="overflow-hidden rounded-md bg-surface shadow-card">
                {group.items.map((p) => (
                  <StockRow key={p.id} product={p} onEdit={() => setEditing(p)} onInStock={(on) => setInStock(p, on)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {editing && (
        <ProductSheet
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </main>
  );
}

// Add by tap, or read a supplier's bill (O-10).
function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex gap-2">
      <ButtonLink href="/app/camera" variant="gray" icon={<Camera aria-hidden className="size-5" />}>
        {t("camera.scan")}
      </ButtonLink>
      <Button variant="tinted" onClick={onClick} icon={<Plus aria-hidden className="size-5" />}>
        {t("stock.add")}
      </Button>
    </div>
  );
}

// Doc 06 StockRow: name, unit, price, stock count or in/out badge; tap to
// edit. The switch is its own control beside the row, not inside it.
function StockRow({ product, onEdit, onInStock }: { product: StockProduct; onEdit: () => void; onInStock: (on: boolean) => void }) {
  const { t } = useLang();
  const titleId = useId();
  const forecast = Array.isArray(product.product_forecasts) ? product.product_forecasts[0] : product.product_forecasts;
  const low =
    product.is_in_stock &&
    product.stock_qty !== null &&
    ((forecast?.order_qty ?? 0) > 0 || (forecast?.reorder_point == null && product.stock_qty <= product.low_stock_level));
  const meta = [product.price_paise ? formatRupees(product.price_paise) : null, product.unit].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-1 pr-3 [&+li>button>span:last-child]:border-t [&+li>button>span:last-child]:border-separator">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 pl-4 text-left active:bg-fill">
        <IconTile icon={product.is_in_stock ? <Package /> : <PackageX />} tone={product.is_in_stock ? (low ? "check" : "accent") : "danger"} />
        <span className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={titleId} className={cn("line-clamp-2 text-body", !product.is_in_stock && "text-ink-2")}>
              {product.name}
            </span>
            {meta && <span className="truncate text-footnote text-ink-2">{meta}</span>}
          </span>
          {!product.is_in_stock ? (
            <Badge tone="danger">{t("status.outOfStock")}</Badge>
          ) : low ? (
            <Badge tone="low" icon={<TriangleAlert aria-hidden />}>
              {product.stock_qty}
            </Badge>
          ) : (
            <span className="text-body text-ink-2 tabular-nums">{product.stock_qty ?? ""}</span>
          )}
        </span>
      </button>
      <Switch checked={product.is_in_stock} onCheckedChange={onInStock} label={t("stock.inStockLabel", { name: product.name })} />
    </li>
  );
}

const rupees = (paise: number | null) => (paise ? String(paise / 100) : "");

// Edit an existing product, or add a new one (doc 02: catalog edits by tap).
function ProductSheet({
  product,
  onClose,
  onSaved,
}: {
  product: StockProduct | "new";
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const { t } = useLang();
  const isNew = product === "new";
  const [form, setForm] = useState({
    name: isNew ? "" : product.name,
    price: isNew ? "" : rupees(product.price_paise),
    unit: isNew ? "" : (product.unit ?? ""),
    category: isNew ? "" : (product.category ?? ""),
    count: isNew ? "" : product.stock_qty === null ? "" : String(product.stock_qty),
    low: isNew ? "2" : String(product.low_stock_level),
  });
  const [invalid, setInvalid] = useState<keyof typeof form | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const set = (field: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });
  const step = (by: number) => setForm({ ...form, count: String(Math.max(0, (Number.parseInt(form.count, 10) || 0) + by)) });

  async function save() {
    setInvalid(null);
    setError(null);
    const name = form.name.trim();
    if (!name) return setInvalid("name");
    const priceValue = form.price.trim() ? Number.parseFloat(form.price) : null;
    if (priceValue !== null && !(priceValue > 0)) return setInvalid("price");
    const count = form.count.trim() ? Number.parseInt(form.count, 10) : null;
    if (count !== null && !(count >= 0)) return setInvalid("count");
    const low = Number.parseInt(form.low, 10);
    if (!(low >= 0)) return setInvalid("low");

    const fields = {
      name,
      price_paise: priceValue === null ? null : Math.round(priceValue * 100),
      unit: form.unit.trim() || null,
      category: form.category.trim() || null,
      low_stock_level: low,
    };
    setBusy(true);
    try {
      if (isNew) {
        await api("/api/v1/products", { json: { ...fields, stock_qty: count } });
        await onSaved(t("stock.added", { name }));
        return;
      }
      // An item with no count yet set to 0 has nothing to move: it's simply
      // out of stock.
      const noneLeft = count === 0 && product.stock_qty === null;
      await api(`/api/v1/products/${product.id}`, { method: "PATCH", json: noneLeft ? { ...fields, is_in_stock: false } : fields });
      // Counts change only through the movement log (decision K2).
      if (count !== null && count !== product.stock_qty && !noneLeft) {
        await api("/api/v1/stock-movements", {
          json: { product_id: product.id, kind: "CORRECTION", qty: count - (product.stock_qty ?? 0), idempotency_key: crypto.randomUUID() },
        });
      }
      await onSaved(t("stock.saved"));
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  async function remove() {
    if (isNew) return;
    setBusy(true);
    try {
      await api(`/api/v1/products/${product.id}`, { method: "DELETE" });
      setConfirmRemove(false);
      await onSaved(t("stock.removed"));
    } catch (failure) {
      setConfirmRemove(false);
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: MessageKey, inputMode?: "decimal" | "numeric" | "text", hint?: string) => (
    <TextField
      label={t(label)}
      value={form[key]}
      onChange={set(key)}
      inputMode={inputMode}
      hint={hint}
      error={invalid === key ? t("error.invalidChange") : undefined}
    />
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? t("stock.new") : t("stock.edit")}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={save}>
            {t("action.save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {field("name", "field.name")}
        <div className="grid grid-cols-2 gap-3">
          {field("price", "field.price", "decimal")}
          {field("unit", "field.unit")}
        </div>
        {field("category", "field.category")}

        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-footnote font-medium text-ink-2">{t("stock.count")}</span>
          <div className="flex items-center gap-2">
            <Button variant="gray" aria-label={t("stock.countLess")} onClick={() => step(-1)} className="w-12 px-0">
              <Minus aria-hidden className="size-5" />
            </Button>
            <input
              aria-label={t("stock.count")}
              inputMode="numeric"
              value={form.count}
              onChange={set("count")}
              placeholder={t("stock.notCounted")}
              aria-invalid={invalid === "count" || undefined}
              className="min-h-12 min-w-0 flex-1 rounded-md bg-fill px-4 text-center text-headline font-semibold tabular-nums text-ink outline-none placeholder:text-body placeholder:font-normal placeholder:text-ink-2 focus-visible:outline-3 focus-visible:outline-accent"
            />
            <Button variant="gray" aria-label={t("stock.countMore")} onClick={() => step(1)} className="w-12 px-0">
              <Plus aria-hidden className="size-5" />
            </Button>
          </div>
          {!isNew && <p className="px-1 text-footnote text-ink-2">{t("stock.countHint")}</p>}
        </div>
        {field("low", "stock.lowLevel", "numeric")}

        {!isNew && (
          <Button variant="destructive" icon={<Trash2 aria-hidden className="size-5" />} onClick={() => setConfirmRemove(true)}>
            {t("stock.remove")}
          </Button>
        )}
      </div>
      {!isNew && (
        <AlertDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          title={t("stock.remove.title", { name: product.name })}
          message={t("stock.remove.body")}
          cancelLabel={t("action.cancel")}
          confirmLabel={t("action.delete")}
          destructive
          busy={busy}
          onConfirm={remove}
        />
      )}
    </Sheet>
  );
}
