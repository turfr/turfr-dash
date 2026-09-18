type Activity = {
    date: string;
    amount: number;
    note: string | null;
};

type ActivityListProps = {
    activities: Activity[];
};

export function ActivityList({ activities }: ActivityListProps) {
    return (
        <section>
            <h2>Recent Activity</h2>

            {activities.map((activity) => (
                <div key={`${activity.date}-${activity.amount}`}>
                    <strong>{activity.date}</strong>
                    <span> — ₹{activity.amount.toLocaleString("en-IN")}</span>
                    {activity.note && <span> — {activity.note}</span>}
                </div>
            ))}
        </section>
    );
}