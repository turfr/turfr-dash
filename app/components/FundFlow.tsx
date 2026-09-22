type FundFlowItem = {
    label: string;
    amount: number;
    color: string;
};

type FundFlowProps = {
    matchReceived: number;
    sponsorTotal: number;
    purchaseTotal: number;
    onMatchCollectionClick: () => void;
};

export function FundFlow({
                             matchReceived,
                             sponsorTotal,
                             purchaseTotal,
                             onMatchCollectionClick,
                         }: FundFlowProps) {
    const items: FundFlowItem[] = [
        {
            label: "Match Collection",
            amount: matchReceived,
            color: "#22c55e",
        },
        {
            label: "Sponsors",
            amount: sponsorTotal,
            color: "#ec4899",
        },
        {
            label: "Purchases",
            amount: purchaseTotal,
            color: "#3b82f6",
        },
    ];

    const total = items.reduce(
        (sum, item) => sum + item.amount,
        0,
    );

    return (
        <section
            style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
        >
            {/* Fund flow bar */}
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "24px",
                    overflow: "hidden",
                    borderRadius: "8px",
                }}
            >
                {items.map((item) => {
                    const percentage =
                        (item.amount / total) * 100;

                    return (
                        <div
                            key={item.label}
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: item.color,
                            }}
                        />
                    );
                })}
            </div>

            {/* Legend */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "16px",
                }}
            >
                {items.map((item) => (
                    <div
                        key={item.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Label */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <span
                                style={{
                                    width: "8px",
                                    height: "8px",
                                    flexShrink: 0,
                                    borderRadius: "50%",
                                    backgroundColor: item.color,
                                }}
                            />

                            <span
                                style={{
                                    fontSize: "12px",
                                    color: "#737373",
                                }}
                            >
                                {item.label}
                            </span>
                        </div>

                        {/* Amount */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "var(--font-ibm-plex-mono)",
                                    fontSize: "14px",
                                    color: "#171717",
                                }}
                            >
                                ₹
                            </span>

                            {item.label === "Match Collection" ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={onMatchCollectionClick}
                                        style={{
                                            fontFamily: "var(--font-jetbrains-mono)",
                                            fontSize: "14px",
                                            fontWeight: 400,
                                            lineHeight: "1",
                                            color: "#171717",
                                            fontVariantNumeric: "tabular-nums",
                                            textDecoration: "underline",
                                            textUnderlineOffset: "0 px",
                                            textDecorationThickness: "1px",
                                            cursor: "pointer",
                                            background: "none",
                                            border: "none",
                                            padding: 0,
                                        }}
                                    >
                                        {item.amount.toLocaleString("en-IN")}
                                    </button>

                                    <span
                                        style={{
                                            fontFamily: "var(--font-jetbrains-mono)",
                                            fontSize: "9px",
                                            lineHeight: "1",
                                            color: "#a3a3a3",
                                            fontVariantNumeric: "tabular-nums",
                                            marginLeft: "1px",
                                            letterSpacing: "-0.03em",
                                        }}
                                    >
                                        .00
                                    </span>
                                </>
                            ) : (
                                <span
                                    style={{
                                        fontFamily: "var(--font-jetbrains-mono)",
                                        fontSize: "14px",
                                        color: "#171717",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {item.amount.toLocaleString("en-IN")}

                                    <span
                                        style={{
                                            fontSize: "9px",
                                            color: "#a3a3a3",
                                            marginLeft: "1px",
                                        }}
                                    >
                                        .00
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}