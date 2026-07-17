import type { Category } from "../lib/types";

type Props = {
  categories: Category[];
  onSelect: (category: Category) => void;
  onCustomSelect: () => void;
  disabled?: boolean;
};

export default function CategoryCards({
  categories,
  onSelect,
  onCustomSelect,
  disabled,
}: Props) {
  return (
    <div className="category-cards">
      <div className="category-cards-label">Or pick one yourself</div>
      <div className="category-cards-grid">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="category-card"
            style={{ borderColor: cat.color }}
            disabled={disabled}
            onClick={() => onSelect(cat)}
          >
            <span
              className="category-card-swatch"
              style={{ background: cat.color }}
              aria-hidden="true"
            >
              {cat.emoji}
            </span>
            <span className="category-card-name">{cat.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="category-card category-card-custom"
          disabled={disabled}
          onClick={onCustomSelect}
        >
          <span className="category-card-swatch category-card-swatch-custom" aria-hidden="true">
            📷
          </span>
          <span className="category-card-name">Custom</span>
        </button>
      </div>
    </div>
  );
}
