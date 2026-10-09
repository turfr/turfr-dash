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
    restingTeams: readonly [Team];
};

export type ClassicSessionPlan<Team extends RotationTeam = RotationTeam> = {
    mode: "classic-three-team-v1";
    fixtures: ClassicRotationFixture<Team>[];
    fixtureCount: number;
    matchMinutes: number;
    sessionWindowMinutes: number;
    plannedPlayMinutes: number;
    plannedBufferMinutes: number;
};

const CLASSIC_CYCLE = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
] as const;

/** Generates the twelve fixtures for four repeats of the A-B, B-C, C-A rotation. */
export function generateClassicRotation<
    TeamA extends RotationTeam,
    TeamB extends RotationTeam,
    TeamC extends RotationTeam,
>(
    teams: readonly [TeamA, TeamB, TeamC],
    fixtureCount = 12,
): ClassicRotationFixture<TeamA | TeamB | TeamC>[] {
    const [teamA, teamB, teamC] = teams;

    if (new Set([teamA.id, teamB.id, teamC.id]).size !== 3) {
        throw new Error("Classic rotation requires three distinct teams.");
    }

    if (!Number.isInteger(fixtureCount) || fixtureCount < 3 || fixtureCount % 3 !== 0) {
        throw new Error("Classic rotation fixture count must be a positive multiple of three.");
    }

    const fixtures: ClassicRotationFixture<TeamA | TeamB | TeamC>[] = [];

    for (let cycleIndex = 0; cycleIndex < fixtureCount / CLASSIC_CYCLE.length; cycleIndex += 1) {
        for (const [homeIndex, awayIndex, restingIndex] of CLASSIC_CYCLE) {
            const resting = teams[restingIndex];
            fixtures.push({
                matchNumber: fixtures.length + 1,
                cycleNumber: cycleIndex + 1,
                home: teams[homeIndex],
                away: teams[awayIndex],
                resting,
                restingTeams: [resting] as const,
            });
        }
    }

    return fixtures;
}

export function createClassicSessionPlan<
    TeamA extends RotationTeam,
    TeamB extends RotationTeam,
    TeamC extends RotationTeam,
>(input: {
    teams: readonly [TeamA, TeamB, TeamC];
    fixtureCount: number;
    matchMinutes: number;
    sessionWindowMinutes: number;
}): ClassicSessionPlan<TeamA | TeamB | TeamC> {
    const { teams, fixtureCount, matchMinutes, sessionWindowMinutes } = input;

    if (!Number.isInteger(matchMinutes) || matchMinutes < 1 || matchMinutes > 60) {
        throw new Error("Match duration must be a whole number of minutes from 1 to 60.");
    }

    const plannedPlayMinutes = fixtureCount * matchMinutes;

    if (!Number.isInteger(sessionWindowMinutes) || sessionWindowMinutes < plannedPlayMinutes) {
        throw new Error("Session window must cover all planned playing time.");
    }

    return {
        mode: "classic-three-team-v1",
        fixtures: generateClassicRotation(teams, fixtureCount),
        fixtureCount,
        matchMinutes,
        sessionWindowMinutes,
        plannedPlayMinutes,
        plannedBufferMinutes: sessionWindowMinutes - plannedPlayMinutes,
    };
}
