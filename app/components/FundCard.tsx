type FundCardProps = {
    title: string;
    value: string;
    subtitle?: string;
    onClick?: () => void;
};

export function FundCard({
                             title,
                             value,
                             subtitle,
                             onClick,
                         }: FundCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="h-28 w-36 shrink-0 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition-transform active:scale-[0.98]"
        >
            <p className="text-xs font-medium text-neutral-500">
                {title}
            </p>

            <p className="mt-3 text-xl font-semibold tracking-tight">
                {value}
            </p>

            {subtitle && (
                <p className="mt-1 truncate text-xs text-neutral-400">
                    {subtitle}
                </p>
            )}
        </button>
    );
}