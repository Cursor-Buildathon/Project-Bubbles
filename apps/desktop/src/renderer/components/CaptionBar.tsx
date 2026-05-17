interface CaptionBarProps {
  text: string;
}

export function CaptionBar({ text }: CaptionBarProps) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return null;
  }

  return (
    <div className="caption-bar" role="status" aria-label="Voice caption">
      {trimmedText}
    </div>
  );
}
