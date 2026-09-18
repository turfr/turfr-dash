type SummaryRowProps = {
    title: string;
    value: string;
    description?: string;
    onClick?: () => void;
};

export function SummaryRow({
                               title,
                               value,
                               description,
                               onClick,
                           }: SummaryRowProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-20 w-full items-center justify-between border-b border-neutral-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-neutral-50"
        >
            <div>
                <h2 className="text-sm font-medium text-neutral-900">
                    {title}
                </h2>

                {description && (
                    <p className="mt-1 text-xs text-neutral-500">
                        {description}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{value}</span>
                <span className="text-lg text-neutral-300">›</span>
            </div>
        </button>
    );
}