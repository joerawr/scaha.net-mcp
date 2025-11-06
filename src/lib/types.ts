// TypeScript interfaces matching scaha.net data structures

export interface TeamStats {
  team: string;
  gp: number;  // games played
  w: number;   // wins
  l: number;   // losses
  t: number;   // ties
  points: number;
  gf: number;  // goals for
  ga: number;  // goals against
  gd: number;  // goal differential
}

export interface PlayerStats {
  number: string;
  name: string;
  team: string;
  gp: number;   // games played
  g: number;    // goals
  a: number;    // assists
  pts: number;  // points
  pims: number; // penalty minutes
}

export interface GoalieStats {
  number: string;
  name: string;
  team: string;
  gp: number;      // games played
  mins: number;    // minutes played
  shots: number;   // shots against
  saves: number;   // saves made
  sv_pct: number | null;  // save percentage
  gaa: number | null;     // goals against average
}

export interface Game {
  game_id: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM:SS
  type: string;           // "Game", "Playoff", "Tournament"
  status: string;         // "Final" or "Scheduled"
  home: string;
  away: string;
  home_score?: number | string;  // numeric or "--"
  away_score?: number | string;  // numeric or "--"
  venue: string;
  rink: string;
}

// Tool parameter types
export interface GetTeamStatsParams {
  season: string;
  division: string;
  team_slug: string;
}

export interface GetPlayerStatsParams {
  season: string;
  division: string;
  team_slug: string;
  player: {
    name?: string;
    number?: string;
  };
}

export interface GetScheduleParams {
  season: string;
  division?: string;
  team_slug?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface GetScheduleCSVParams {
  season: string;
  division?: string;
  team_slug?: string;
}

export interface ScheduleCSVResponse {
  filename: string;
  mime: string;
  data_base64: string;
}

export interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface ScoreboardOptionState {
  seasons: SelectOption[];
  schedules: SelectOption[];
  teams: SelectOption[];
}

export interface TeamRoster {
  team: string;
  division: string;
  season: string;
  players: PlayerStats[];
  goalies: GoalieStats[];
}

export interface GetTeamRosterParams {
  season: string;
  division: string;
  team_slug: string;
}
