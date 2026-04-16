function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="aspect-[3/4] rounded-lg skeleton" />
      <div className="h-4 w-3/4 rounded skeleton" />
      <div className="h-3 w-1/2 rounded skeleton" />
    </div>
  );
}

export default SkeletonCard;
