export type RotationTeam = {
    id: string;
    label: string;
    color: string;
};

export type ClassicRotationFixture<Team extends RotationTeam = RotationTeam> = {
    matchNumber: number;
    cycleNumber: number;
    home: Team;
    away: Team;
    resting: Team;
};

const CLASSIC_CYCLE = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
] as const;

/** Generates the twelve fixtures for four repeats of the A-B, B-C, C-A rotation. */
export function generateClassicRotation<Team extends RotationTeam>(
    teams: readonly [Team, Team, Team],
): ClassicRotationFixture<Team>[] {
    const [teamA, teamB, teamC] = teams;

    if (new Set([teamA.id, teamB.id, teamC.id]).size !== 3) {
        throw new Error("Classic rotation requires three distinct teams.");
    }

    const fixtures: ClassicRotationFixture<Team>[] = [];

    for (let cycleIndex = 0; cycleIndex < 4; cycleIndex += 1) {
        for (const [homeIndex, awayIndex, restingIndex] of CLASSIC_CYCLE) {
            fixtures.push({
                matchNumber: fixtures.length + 1,
                cycleNumber: cycleIndex + 1,
                home: teams[homeIndex],
                away: teams[awayIndex],
                resting: teams[restingIndex],
            });
        }
    }

    return fixtures;
}
