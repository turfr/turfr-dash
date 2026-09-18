type FundSummaryProps = {
    amount: number;
};

export function FundSummary({ amount }: FundSummaryProps) {
    return (
        // <section className="relative h-40 rounded-2xl bg-neutral-900 text-center shadow-sm ring-1 ring-black/5">
        //     <section
        //         className="relative rounded-2xl bg-neutral-900 text-center shadow-sm ring-1 ring-black/5"
        //         style={{ height: "170px" }}
        //     >
        <section
            className="rounded-2xl bg-neutral-900 text-center shadow-sm ring-1 ring-black/5"
            style={{
                height: "130px",
                display: "grid",
                gridTemplateRows: "1fr auto",
            }}
        >
            {/* Amount display */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div className="flex items-center justify-center">
                    {/* Rupee symbol */}
                    <span
                        className="font-medium"
                        style={{
                            fontFamily: "var(--font-ibm-plex-mono)",
                            fontSize: "32px",
                            lineHeight: "1",
                            color: "#f7f7f5",
                        }}
                    >
                        ₹
                    </span>

                    {/* Main amount + bottom-aligned decimal */}
                    <span
                        className="relative tracking-tight"
                        style={{
                            fontFamily: "var(--font-jetbrains-mono)",
                            fontSize: "44px",
                            lineHeight: "1",
                            color: "#f7f7f5",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {amount.toLocaleString("en-IN")}

                        <span
                            className="absolute bottom-0 left-full ml-1 font-medium"
                            style={{
                                fontFamily: "var(--font-jetbrains-mono)",
                                fontSize: "18px",
                                lineHeight: "1",
                                color: "#a3a3a3",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            .00
                        </span>
                    </span>
                </div>
            </div>

            {/* Update status */}
            <p
                className="text-xs"
                style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "#a3a3a3",
                    paddingBottom: "24px",
                }}
            >
                {/*// TODO: Make this responsive*/}
                updated Today at 10:35 AM
            </p>

        </section>
    );
}