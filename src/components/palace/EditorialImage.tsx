interface Props {
  src?: string | null;
  seed: string;
  ratio?: "3/4" | "4/5" | "3/2" | "1/1" | "16/9" | "5/4";
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  color?: boolean;
}

export function EditorialImage({
  src,
  ratio = "3/4",
  className = "",
  alt = "",
  priority,
color = false,
}: Props) {
  const hasSrc = typeof src === "string" && src.trim().length > 0;

  return (
    <div
      className={`palace-image relative overflow-hidden bg-[#FFFFFF] ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      {hasSrc ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="palace-image-inner absolute inset-0 h-full w-full object-cover"
          style={color ? { filter: "none" } : undefined}
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border-[1.5px] border-black bg-[#FFFFFF]">
          <span className="palace-eyebrow text-[#000000]">Ohne Bild</span>
        </div>
      )}
    </div>
  );
}
