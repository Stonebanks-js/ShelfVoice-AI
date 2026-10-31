"use client";

import { Check, CircleAlert, CircleCheck, Inbox, Mic, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Switch } from "@/components/ui/controls";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api, ApiFailure } from "@/lib/api";
import { describeChange, needsCheck, type CatalogEntry } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import { parseExtras, proposalExtrasRaw } from "@/lib/voice";
import { toE164, type Change } from "@/server/changes";

interface Proposal {
  id: string;
  kind: string;
  status: string;
  transcript: string | null;
  changes: Change[];
}

const noSubscribe = () => () => undefined;

interface Item {
  key: number;
  change: Change;
  selected: boolean;
}

export function CheckScreen({ proposal, catalog }: { proposal: Proposal; catalog: CatalogEntry[] }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  // Doc 06: anything unclear starts unselected, so it's never saved by accident.
  const [items, setItems] = useState<Item[]>(() =>
    proposal.changes.map((change, key) => ({ key, change, selected: !needsCheck(change) })),
  );
  // Session storage exists only in the browser; the server renders no extras.
  const extrasRaw = useSyncExternalStore(
    noSubscribe,
    () => proposalExtrasRaw(proposal.id),
    () => null,
  );
  const extras = useMemo(() => parseExtras(extrasRaw), [extrasRaw]);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [closed, setClosed] = useState(proposal.status !== "PENDING");

  const selected = items.filter((i) => i.selected);
  const confirmLabel =
    selected.length === 0 ? t("check.confirm0") : selected.length === 1 ? t("check.confirm1") : t("check.confirmN", { n: selected.length });

  async function undo() {
    try {
      await api(`/api/v1/proposals/${proposal.id}/undo`, { method: "POST" });
      toast.show({ message: t("toast.undone") });
      router.refresh();
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/proposals/${proposal.id}/confirm`, { json: { changes: selected.map((i) => i.change) } });
      // Doc 06: "5 changes saved" with Undo for 10 seconds.
      toast.show({ message: t("toast.saved", { n: selected.length }), action: { label: t("action.undo"), onAction: () => void undo() } });
      router.replace("/app");
      router.refresh();
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.code === "PROPOSAL_NOT_PENDING") setClosed(true);
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader title={t("check.title")} />
        <div className="px-4">
          <EmptyState
            icon={<CircleCheck />}
            title={t("check.closed.title")}
            body={t("check.closed.body")}
            action={<ButtonLink href="/app" size="lg">{t("action.done")}</ButtonLink>}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-40">
      <PageHeader title={t("check.title")} />

      {proposal.transcript && (
        <section className="mx-4 rounded-lg bg-surface p-4 shadow-card">
          <h2 className="text-footnote font-semibold text-ink-2">{t("check.heard")}</h2>
          <p className={cn("mt-1 text-body", !showAll && "line-clamp-2")}>{proposal.transcript}</p>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className="mt-1 min-h-10 text-footnote font-semibold text-accent"
          >
            {showAll ? t("check.showLess") : t("check.showAll")}
          </button>
        </section>
      )}

      {extras.question && (
        <p className="mx-4 flex gap-2 rounded-lg bg-check-soft p-4 text-body text-check">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong className="font-semibold">{t("status.check")}: </strong>
            {extras.question}
          </span>
        </p>
      )}

      {items.length === 0 ? (
        <div className="px-4">
          <EmptyState
            icon={<Inbox />}
            title={t("check.empty.title")}
            body={t("check.empty.body")}
            action={
              <ButtonLink href="/app" size="lg" icon={<Mic aria-hidden className="size-5" />}>
                {t("check.speakAgain")}
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <section className="flex flex-col gap-2 px-4">
          <h2 className="px-1 text-footnote font-medium text-ink-2">{t("check.changes")}</h2>
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const view = describeChange(item.change, catalog, lang);
              const unclear = needsCheck(item.change);
              return (
                <li
                  key={item.key}
                  className={cn(
                    // Unselected stays full strength (dimming fails contrast);
                    // the empty circle says it won't be saved.
                    "flex items-start gap-3 rounded-lg bg-surface p-3 shadow-card",
                    unclear && "ring-2 ring-check/60",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.selected}
                    aria-label={`${t("check.include")}: ${view.title}`}
                    onClick={() => setItems(items.map((i) => (i.key === item.key ? { ...i, selected: !i.selected } : i)))}
                    className="grid size-12 shrink-0 place-items-center"
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full border-2",
                        item.selected ? "border-accent-fill bg-accent-fill text-on-accent" : "border-ink-2",
                      )}
                    >
                      {item.selected && <Check aria-hidden className="size-4" strokeWidth={3} />}
                    </span>
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
                    <p className="text-body font-semibold">{view.title}</p>
                    {view.details.map((d) => (
                      <p key={d} className="text-footnote text-ink-2">
                        {d}
                      </p>
                    ))}
                    {unclear && (
                      <span>
                        <Badge tone="check" icon={<CircleAlert aria-hidden />}>
                          {t("status.check")}
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={`${t("action.edit")}: ${view.title}`}
                      onClick={() => setEditing(item)}
                      className="grid size-12 place-items-center rounded-md text-accent active:bg-fill"
                    >
                      <Pencil aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t("action.remove")}: ${view.title}`}
                      onClick={() => setItems(items.filter((i) => i.key !== item.key))}
                      className="grid size-12 place-items-center rounded-md text-danger active:bg-fill"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {extras.rejected.length > 0 && (
            <p className="px-1 text-footnote text-ink-2">
              {t("check.leftOut")}: {extras.rejected.join(" · ")}
            </p>
          )}
        </section>
      )}

      {/* Doc 06: the confirm action sits in the thumb zone. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-chrome backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} disabled={selected.length === 0} onClick={confirm}>
            {confirmLabel}
          </Button>
          <Button variant="plain" onClick={() => router.push("/app")}>
            {t("action.cancel")}
          </Button>
        </div>
      </div>

      {editing && (
        <EditSheet
          key={editing.key}
          change={editing.change}
          title={describeChange(editing.change, catalog, lang).title}
          onClose={() => setEditing(null)}
          onSave={(change) => {
            // An edited change was checked by the owner, so it's included.
            setItems(items.map((i) => (i.key === editing.key ? { ...i, change, selected: true } : i)));
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

const rupees = (paise: number | null | undefined) => (paise ? String(paise / 100) : "");
const toPaise = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};
const toInt = (value: string, min: number) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= min ? n : null;
};

// One sheet for every kind of change: only the fields that change carries.
function EditSheet({
  change,
  title,
  onClose,
  onSave,
}: {
  change: Change;
  title: string;
  onClose: () => void;
  onSave: (change: Change) => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState((): Record<string, string> => {
    switch (change.op) {
      case "add_product":
        return { name: change.name, price: rupees(change.price_paise), unit: change.unit ?? "", category: change.category ?? "" };
      case "update_shop":
        return { name: change.name ?? "", phone: change.phone?.replace(/^\+91/, "") ?? "", address: change.address ?? "" };
      case "update_price":
        return { price: rupees(change.price_paise) };
      case "set_stock_count":
        return { count: String(change.count) };
      case "record_sale":
      case "record_delivery":
        return { qty: String(change.qty) };
      case "set_in_stock":
        return { inStock: change.in_stock ? "1" : "" };
    }
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const set = (field: string) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  function save() {
    setInvalid(null);
    let next: Change | null = null;
    switch (change.op) {
      case "add_product": {
        const name = form.name.trim();
        if (!name) return setInvalid("name");
        next = { ...change, name, price_paise: toPaise(form.price), unit: form.unit.trim() || null, category: form.category.trim() || null };
        break;
      }
      case "update_shop": {
        const phone = form.phone.trim() ? toE164(form.phone) : null;
        if (form.phone.trim() && !phone) return setInvalid("phone");
        next = { ...change, name: form.name.trim() || undefined, phone, address: form.address.trim() || null };
        break;
      }
      case "update_price": {
        const price = toPaise(form.price);
        if (!price) return setInvalid("price");
        next = { ...change, price_paise: price };
        break;
      }
      case "set_stock_count": {
        const count = toInt(form.count, 0);
        if (count === null) return setInvalid("count");
        next = { ...change, count };
        break;
      }
      case "record_sale":
      case "record_delivery": {
        const qty = toInt(form.qty, 1);
        if (qty === null) return setInvalid("qty");
        next = { ...change, qty };
        break;
      }
      case "set_in_stock":
        next = { ...change, in_stock: form.inStock === "1" };
        break;
    }
    onSave(next);
  }

  const field = (name: string, label: MessageKey, props: { inputMode?: "decimal" | "numeric" | "tel" | "text" } = {}) => (
    <TextField
      key={name}
      label={t(label)}
      value={form[name]}
      onChange={set(name)}
      inputMode={props.inputMode}
      error={invalid === name ? t("error.invalidChange") : undefined}
    />
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("edit.title")}
      doneLabel={t("action.cancel")}
      footer={
        <Button size="lg" onClick={save}>
          {t("action.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-footnote text-ink-2">{title}</p>
        {change.op === "add_product" && [
          field("name", "field.name"),
          field("price", "field.price", { inputMode: "decimal" }),
          field("unit", "field.unit"),
          field("category", "field.category"),
        ]}
        {change.op === "update_shop" && [
          field("name", "field.name"),
          field("phone", "field.phone", { inputMode: "tel" }),
          field("address", "field.address"),
        ]}
        {change.op === "update_price" && field("price", "field.price", { inputMode: "decimal" })}
        {change.op === "set_stock_count" && field("count", "field.count", { inputMode: "numeric" })}
        {(change.op === "record_sale" || change.op === "record_delivery") && field("qty", "field.qty", { inputMode: "numeric" })}
        {change.op === "set_in_stock" && (
          <div className="flex items-center justify-between rounded-md bg-surface px-4 py-1 shadow-card">
            <span id="edit-in-stock" className="text-body">
              {t("field.inStock")}
            </span>
            <Switch
              checked={form.inStock === "1"}
              onCheckedChange={(on) => setForm({ ...form, inStock: on ? "1" : "" })}
              labelledBy="edit-in-stock"
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
