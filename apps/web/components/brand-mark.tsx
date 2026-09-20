export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-label="Moxie">
      <span className="brand-glyph" aria-hidden="true">
        <i />
        <i />
      </span>
      {!compact && <span>MOXIE</span>}
    </span>
  );
}
