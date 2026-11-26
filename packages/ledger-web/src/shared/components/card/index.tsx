import { formatValue } from "@/shared/helpers/helpers";
import { ITEM_LABEL, LOCALE } from "@/shared/utils";
import type { ChatCell, ValueFormat } from "@/types";
import { useTranslation } from "react-i18next";

interface CardProps {
  type?: "card";
  titleKey: string;
  params: Record<string, ChatCell>;
  items: { key: string; format: ValueFormat; value: ChatCell }[];
}

const Card = ({ titleKey, items, params }: Readonly<CardProps>) => {
  const { t, i18n } = useTranslation();
  const locale = LOCALE[i18n.language] ?? "nl-NL";
  const title = t(titleKey, params);
  return (
    <section
      id={`card-${titleKey}`}
      className="flex flex-col w-fit h-fit gap-4 rounded-lg border border-hairline-soft p-6"
    >
      <h3 className="font-serif text-xl">{title}</h3>
      <dl className="flex flex-row gap-4">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-1">
            <dt className="text-xs text-steel">
              {t(ITEM_LABEL[item.key] ?? item.key)}
            </dt>
            <dd className="text-lg font-medium">
              {formatValue(item.value, item.format, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default Card;
