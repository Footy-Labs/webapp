"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  LabelList,
} from "recharts"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type TeamMetrics = {
  team_id?: number
  Team: string
  xG: number
  PPDA: number
  "Duels Success %": number
  "Pass Accuracy": number
  "Points Earned": number
  League?: string
  [key: string]: any
}

export default function CurrentSeasonInsights({ clubId }: { clubId?: number }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null)
  const [allTeams, setAllTeams] = useState<TeamMetrics[]>([])
  const [selectedMetric, setSelectedMetric] = useState("xG")
  const [teamLeague, setTeamLeague] = useState<string | null>(null)
  const supabase = createClient()

  // First, get the league of the logged-in team
  useEffect(() => {
    const getTeamLeague = async () => {
      if (!clubId) return

      try {
        const { data, error } = await supabase
          .from("team_metrics_aggregated")
          .select("League")
          .eq("team_id", clubId)
          .single()

        if (error) {
          console.error("Error fetching team league:", error)
          return
        }

        if (data && data.League) {
          console.log("Team league:", data.League)
          setTeamLeague(data.League)
        } else {
          console.warn("No league found for team ID:", clubId)
        }
      } catch (err) {
        console.error("Error in getTeamLeague:", err)
      }
    }

    getTeamLeague()
  }, [clubId, supabase])

  // Fetch metrics for the logged-in team
  useEffect(() => {
    const fetchData = async () => {
      if (!clubId) return

      try {
        setLoading(true)
        setError(null)

        const { data, error: metricsError } = await supabase
          .from("team_metrics_aggregated")
          .select("*")
          .eq("team_id", clubId)
          .single()

        if (metricsError) throw new Error(`Error fetching team metrics: ${metricsError.message}`)

        if (!data) {
          setError("No metrics data available for your team")
          setLoading(false)
          return
        }

        setMetrics(data)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching team metrics:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        setLoading(false)
      }
    }

    fetchData()
  }, [clubId, supabase])

  // Fetch all teams from the same league
  useEffect(() => {
    const fetchAllTeams = async () => {
      if (!teamLeague) {
        console.log("Waiting for team league...")
        return
      }

      try {
        console.log("Fetching teams from league:", teamLeague)

        const { data, error } = await supabase.from("team_metrics_aggregated").select("*").eq("League", teamLeague)

        if (error) throw new Error(error.message)

        if (data) {
          console.log(`Found ${data.length} teams in league ${teamLeague}`)

          const cleaned = data
            .filter(
              (team) =>
                team["Team"] &&
                team["Points Earned"] != null &&
                team["xG"] != null &&
                team["PPDA"] != null &&
                team["Pass Accuracy"] != null &&
                team["Duels Success %"] != null,
            )
            .map((team) => ({
              team_id: team["team_id"],
              Team: team["Team"],
              "Points Earned": team["Points Earned"],
              xG: team["xG"],
              PPDA: team["PPDA"],
              "Pass Accuracy": team["Pass Accuracy"],
              "Duels Success %": team["Duels Success %"],
              League: team["League"],
            }))

          setAllTeams(cleaned)
        }
      } catch (err) {
        console.error("Error fetching teams from league:", err)
      }
    }

    fetchAllTeams()
  }, [teamLeague, supabase])

  function computeRegression(data: any[], xKey: string, yKey: string) {
    if (data.length < 2) return []

    const n = data.length
    const sumX = data.reduce((acc, cur) => acc + cur[xKey], 0)
    const sumY = data.reduce((acc, cur) => acc + cur[yKey], 0)
    const sumXY = data.reduce((acc, cur) => acc + cur[xKey] * cur[yKey], 0)
    const sumXX = data.reduce((acc, cur) => acc + cur[xKey] ** 2, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2)
    const intercept = (sumY - slope * sumX) / n

    const line = data
      .map((point) => ({
        [xKey]: point[xKey],
        [yKey]: slope * point[xKey] + intercept,
      }))
      .sort((a, b) => a[xKey] - b[xKey])

    return line
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Season Insights</h2>
        <div className="flex h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#31348D]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Season Insights</h2>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Season Insights</h2>
        <p className="text-gray-500">No metrics data available</p>
      </div>
    )
  }

  const xG = Number.parseFloat(metrics.xG?.toString() || "0")
  const ppda = Number.parseFloat(metrics.PPDA?.toString() || "0")
  const duelSuccess = Number.parseFloat(metrics["Duels Success %"]?.toString() || "0")
  const passAccuracy = Number.parseFloat(metrics["Pass Accuracy"]?.toString() || "0")

  const highlightedTeam = allTeams.find((team) => team.team_id === clubId)
  const otherTeams = allTeams.filter((team) => team.team_id !== clubId)

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold mb-6">Current Season Performance</h2>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: "Average xG", value: xG.toFixed(2), subtitle: "Expected Goals" },
          { label: "Average PPDA", value: ppda.toFixed(2), subtitle: "Passes Per Defensive Action" },
          { label: "Average Duel Success", value: `${duelSuccess.toFixed(1)}%`, subtitle: "Success Rate" },
          { label: "Average Pass Accuracy", value: `${passAccuracy.toFixed(1)}%`, subtitle: "Completion Rate" },
        ].map((metric, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#31348D]">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="text-4xl font-bold">{metric.value}</div>
                <div className="text-sm text-gray-500 mt-2">{metric.subtitle}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scatterplot */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold mb-4">
          {teamLeague ? `${teamLeague} League Scatterplot` : "League Scatterplot"}
        </h3>

        <div className="mb-4 w-60">
          <Label>Select Y-Axis Metric</Label>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger>
              <SelectValue placeholder="Select Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xG">xG</SelectItem>
              <SelectItem value="PPDA">PPDA</SelectItem>
              <SelectItem value="Pass Accuracy">Pass Accuracy</SelectItem>
              <SelectItem value="Duels Success %">Duel Success %</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {allTeams.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-gray-500">
            No team data available for your league
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={450}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Points Earned" name="Points Earned" type="number" />
              <YAxis dataKey={selectedMetric} name={selectedMetric} type="number" />
              <Tooltip
                content={({ payload }) =>
                  payload?.length ? (
                    <div className="bg-white p-2 rounded shadow text-sm">
                      <div>
                        <strong>{payload[0].payload.Team}</strong>
                      </div>
                      <div>Points: {payload[0].payload["Points Earned"]}</div>
                      <div>
                        {selectedMetric}: {payload[0].payload[selectedMetric]?.toFixed(2)}
                      </div>
                    </div>
                  ) : null
                }
              />
              <Scatter name="Other Teams" data={otherTeams} fill="#31348D">
                <LabelList dataKey="Team" position="top" fontSize={10} />
              </Scatter>
              {highlightedTeam && (
                <Scatter name="Your Team" data={[highlightedTeam]} fill="#DC2626">
                  <LabelList dataKey="Team" position="top" fontSize={10} />
                </Scatter>
              )}
              {allTeams.length > 1 && (
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  data={computeRegression(allTeams, "Points Earned", selectedMetric)}
                  stroke="#31348D"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
