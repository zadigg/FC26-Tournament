import { useTournament } from '../context/TournamentContext'
import { MatchCard } from './MatchCard'
import type { Match } from '../types'
import type { KnockoutStage } from '../types'

const STAGE_LABELS: Record<string, string> = {
  play_in: 'Play-in Round',
  semi: 'Semi-finals',
  final: 'Final',
  third_place: '3rd Place Match',
}

const STAGE_ORDER: Record<string, number> = {
  play_in: 1,
  semi: 2,
  final: 3,
  third_place: 3, // Same round as final
}

interface RoundSectionProps {
  title: string
  matches: Match[]
  playerMap: Map<string, { id: string; name: string }>
  stage: KnockoutStage
  fillKnockoutRound: (stage: KnockoutStage) => void
  testMode: boolean
}

function RoundSection({ title, matches, playerMap, stage, fillKnockoutRound, testMode }: RoundSectionProps) {
  if (matches.length === 0) return null

  const hasUnplayed = matches.some((m) => m.scoreA === null || m.scoreB === null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div>
          <h3 className="text-lg font-semibold text-violet-400">{title}</h3>
          <p className="text-xs text-slate-400 mt-1">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} - Fill results to advance
          </p>
        </div>
        {testMode && hasUnplayed && (
          <button
            type="button"
            onClick={() => fillKnockoutRound(stage)}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
          >
            Fill {title} (test)
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m, idx) => {
          const pa = playerMap.get(m.playerAId)
          const pb = playerMap.get(m.playerBId)
          if (!pa || !pb) return null
          
          const matchLabel = m.stage === 'semi' 
            ? `Semi-final ${idx + 1}`
            : m.stage === 'play_in'
            ? `Play-in ${idx + 1}`
            : ''
          
          return (
            <div key={m.id} className="space-y-2">
              {matchLabel && (
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {matchLabel}
                </div>
              )}
              <MatchCard match={m} playerA={pa} playerB={pb} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KnockoutBracket({ testMode }: { testMode: boolean }) {
  const { matches, players, knockoutSeeds, knockoutPlayerCount, fillKnockoutRound, advanceToFinalStage } = useTournament()
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const knockoutMatches = matches.filter((m) => m.stage).sort((a, b) => {
    const orderA = STAGE_ORDER[a.stage || ''] || 999
    const orderB = STAGE_ORDER[b.stage || ''] || 999
    if (orderA !== orderB) return orderA - orderB
    return a.id.localeCompare(b.id)
  })

  // Show bracket as soon as knockout stage starts (when knockoutSeeds exists)
  if (!knockoutSeeds?.length) return null

  // Group matches by stage
  const playInMatches = knockoutMatches.filter((m) => m.stage === 'play_in')
  const semiMatches = knockoutMatches.filter((m) => m.stage === 'semi')
  const finalMatches = knockoutMatches.filter((m) => m.stage === 'final')
  const thirdPlaceMatches = knockoutMatches.filter((m) => m.stage === 'third_place')

  const getDescription = () => {
    if (!knockoutPlayerCount) return 'Knockout stage'
    if (knockoutPlayerCount === 2) return 'Final (top 2 players)'
    if (knockoutPlayerCount === 3) return 'Play-in → Final (top 3 players)'
    if (knockoutPlayerCount === 4) return 'Semi-finals (2 random games) → Winners play Final, Losers play for 3rd place'
    if (knockoutPlayerCount === 5) return 'Top 3 safe → Play-in (4th vs 5th) → Semi-finals → Final & 3rd place'
    if (knockoutPlayerCount === 6) return 'Top 3 safe → Play-in Round 1 (5th vs 6th) → Play-in Round 2 (winner vs 4th) → Semi-finals → Final & 3rd place'
    if (knockoutPlayerCount === 7) return 'Top 3 safe → Multiple play-in rounds (4th-7th) → Semi-finals → Final & 3rd place'
    return `Knockout stage (top ${knockoutPlayerCount} players) - Top 3 safe, bottom players play multiple play-in rounds until 1 winner remains`
  }

  // Show shuffled seeds info
  const shuffledPlayers = knockoutSeeds.map((id) => {
    const player = playerMap.get(id)
    return player ? player.name : 'Unknown'
  })

  // Show bracket structure even if no matches created yet
  const hasAnyMatches = knockoutMatches.length > 0

  return (
    <div className="space-y-8 rounded-lg border-2 border-violet-500 bg-gradient-to-br from-violet-950/40 to-purple-950/40 p-6 shadow-lg">
      <div className="border-b border-violet-600/30 pb-4">
        <h2 className="text-2xl font-bold text-violet-300 mb-2">🏆 Knockout Bracket</h2>
        <p className="text-sm text-slate-300">{getDescription()}</p>
        
        {/* Show shuffled order */}
        <div className="mt-4 rounded-lg border border-violet-500/40 bg-violet-950/30 p-4">
          <div className="text-sm font-semibold text-violet-400 mb-3 uppercase tracking-wide">Shuffled Draw Order:</div>
          <div className="flex flex-wrap gap-2">
            {shuffledPlayers.map((name, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-full bg-slate-700/80 px-3 py-1.5 text-sm border border-violet-600/30"
              >
                <span className="text-violet-400 font-bold">#{idx + 1}</span>
                <span className="text-slate-100 font-medium">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!hasAnyMatches && (
        <div className="rounded-lg border border-violet-600/30 bg-slate-800/50 p-6 text-center">
          <p className="text-slate-300 text-lg mb-2">⏳ Generating bracket...</p>
          <p className="text-slate-400 text-sm">
            Knockout matches will appear here once the bracket is generated.
          </p>
        </div>
      )}

      {/* Play-in Round */}
      {playInMatches.length > 0 && (
        <div className="space-y-4">
          <RoundSection
            title={STAGE_LABELS.play_in}
            matches={playInMatches}
            playerMap={playerMap}
            stage="play_in"
            fillKnockoutRound={fillKnockoutRound}
            testMode={testMode}
          />
          
          {/* Advance Button (for 3 players: to Final, for 5+ players: to Semi-finals) */}
          {playInMatches.every((m) => m.scoreA !== null && m.scoreB !== null) && 
           finalMatches.length === 0 && 
           semiMatches.length === 0 && 
           knockoutPlayerCount && knockoutPlayerCount >= 3 && (
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-950/30 p-4">
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-1">
                    Play-in Complete! 🎉
                  </h3>
                  <p className="text-sm text-slate-300 mb-2">
                    {knockoutPlayerCount === 3
                      ? 'Play-in winner advances to Final vs 1st place'
                      : knockoutPlayerCount === 6 
                      ? 'Final play-in winner advances to Semi-finals'
                      : 'Play-in winner advances to Semi-finals'}
                  </p>
                  <div className="text-xs text-slate-400 space-y-1">
                    {knockoutPlayerCount === 3 ? (
                      // For 3 players: show play-in result and who advances to final
                      (() => {
                        const m = playInMatches[0]
                        if (!m) return null
                        const pa = playerMap.get(m.playerAId)
                        const pb = playerMap.get(m.playerBId)
                        if (!pa || !pb || m.scoreA === null || m.scoreB === null) return null
                        const winner = m.scoreA > m.scoreB ? pa : pb
                        const loser = m.scoreA > m.scoreB ? pb : pa
                        const [firstSeed] = knockoutSeeds || []
                        const firstPlayer = firstSeed ? playerMap.get(firstSeed) : null
                        return (
                          <>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-emerald-400">Play-in:</span>
                              <span className="text-slate-200 font-medium">{winner.name}</span>
                              <span className="text-emerald-400">→ Final</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-300">{loser.name}</span>
                              <span className="text-slate-500">(eliminated)</span>
                            </div>
                            {firstPlayer && (
                              <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-emerald-600/30">
                                <span className="text-emerald-400 font-semibold">Final:</span>
                                <span className="text-slate-100 font-bold text-sm">{firstPlayer.name}</span>
                                <span className="text-slate-400">vs</span>
                                <span className="text-slate-100 font-bold text-sm">{winner.name}</span>
                              </div>
                            )}
                          </>
                        )
                      })()
                    ) : knockoutPlayerCount === 6 ? (
                      // For 6 players, show final winner separately
                      (() => {
                        const sortedMatches = [...playInMatches].sort((a, b) => a.id.localeCompare(b.id))
                        const finalMatch = sortedMatches[sortedMatches.length - 1]
                        const pa = playerMap.get(finalMatch.playerAId)
                        const pb = playerMap.get(finalMatch.playerBId)
                        if (!pa || !pb || finalMatch.scoreA === null || finalMatch.scoreB === null) return null
                        const finalWinner = finalMatch.scoreA > finalMatch.scoreB ? pa : pb
                        const finalLoser = finalMatch.scoreA > finalMatch.scoreB ? pb : pa
                        return (
                          <>
                            {sortedMatches.slice(0, -1).map((m, idx) => {
                              const p1 = playerMap.get(m.playerAId)
                              const p2 = playerMap.get(m.playerBId)
                              if (!p1 || !p2 || m.scoreA === null || m.scoreB === null) return null
                              const winner = m.scoreA > m.scoreB ? p1 : p2
                              const loser = m.scoreA > m.scoreB ? p2 : p1
                              return (
                                <div key={m.id} className="flex items-center justify-center gap-2">
                                  <span className="text-emerald-400">Play-in {idx + 1}:</span>
                                  <span className="text-slate-200 font-medium">{winner.name}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-300">{loser.name}</span>
                                  <span className="text-slate-500">(eliminated)</span>
                                </div>
                              )
                            })}
                            <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-emerald-600/30">
                              <span className="text-emerald-400 font-semibold">Final Winner:</span>
                              <span className="text-slate-100 font-bold text-sm">{finalWinner.name}</span>
                              <span className="text-emerald-400">→ Semi-finals</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-300">{finalLoser.name}</span>
                              <span className="text-slate-500">(eliminated)</span>
                            </div>
                          </>
                        )
                      })()
                    ) : (
                      // For 5 players, show single winner
                      playInMatches.map((m, idx) => {
                        const pa = playerMap.get(m.playerAId)
                        const pb = playerMap.get(m.playerBId)
                        if (!pa || !pb || m.scoreA === null || m.scoreB === null) return null
                        const winner = m.scoreA > m.scoreB ? pa : pb
                        const loser = m.scoreA > m.scoreB ? pb : pa
                        return (
                          <div key={m.id} className="flex items-center justify-center gap-2">
                            <span className="text-emerald-400">Play-in {idx + 1}:</span>
                            <span className="text-slate-200 font-medium">{winner.name}</span>
                            <span className="text-emerald-400">→ Semi-finals</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-300">{loser.name}</span>
                            <span className="text-slate-500">(eliminated)</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={advanceToFinalStage}
                  className="rounded bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500 shadow-lg transition-all hover:scale-105"
                >
                  {knockoutPlayerCount === 3 
                    ? 'Advance to Final →'
                    : 'Advance to Semi-finals →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Semi-finals Round */}
      {semiMatches.length > 0 && (
        <div className="space-y-4">
          <RoundSection
            title={STAGE_LABELS.semi}
            matches={semiMatches}
            playerMap={playerMap}
            stage="semi"
            fillKnockoutRound={fillKnockoutRound}
            testMode={testMode}
          />
          
          {/* Advance to Final Stage Button */}
          {semiMatches.every((m) => m.scoreA !== null && m.scoreB !== null) && 
           finalMatches.length === 0 && (
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-950/30 p-4">
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-1">
                    Semi-finals Complete! 🎉
                  </h3>
                  <p className="text-sm text-slate-300 mb-2">
                    Winners advance to Final • Losers play for 3rd Place
                  </p>
                  <div className="text-xs text-slate-400 space-y-1">
                    {semiMatches.map((m, idx) => {
                      const pa = playerMap.get(m.playerAId)
                      const pb = playerMap.get(m.playerBId)
                      if (!pa || !pb || m.scoreA === null || m.scoreB === null) return null
                      const winner = m.scoreA > m.scoreB ? pa : pb
                      const loser = m.scoreA > m.scoreB ? pb : pa
                      return (
                        <div key={m.id} className="flex items-center justify-center gap-2">
                          <span className="text-emerald-400">Semi {idx + 1}:</span>
                          <span className="text-slate-200 font-medium">{winner.name}</span>
                          <span className="text-slate-500">→ Final</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300">{loser.name}</span>
                          <span className="text-slate-500">→ 3rd Place</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={advanceToFinalStage}
                  className="rounded bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500 shadow-lg transition-all hover:scale-105"
                >
                  Advance to Final Stage →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Final Round */}
      {finalMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-amber-600/50 pb-2">
            <div>
              <h3 className="text-lg font-semibold text-amber-400">{STAGE_LABELS.final}</h3>
              <p className="text-xs text-slate-400 mt-1">Championship match</p>
            </div>
            {testMode && finalMatches.some((m) => m.scoreA === null || m.scoreB === null) && (
              <button
                type="button"
                onClick={() => fillKnockoutRound('final')}
                className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
              >
                Fill Final (test)
              </button>
            )}
          </div>
          <div className="max-w-md">
            {finalMatches.map((m) => {
              const pa = playerMap.get(m.playerAId)
              const pb = playerMap.get(m.playerBId)
              if (!pa || !pb) return null
              return <MatchCard key={m.id} match={m} playerA={pa} playerB={pb} />
            })}
          </div>
        </div>
      )}

      {/* 3rd Place Match */}
      {thirdPlaceMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-300">{STAGE_LABELS.third_place}</h3>
              <p className="text-xs text-slate-400 mt-1">Semi-final losers compete for 3rd place</p>
            </div>
            {testMode && thirdPlaceMatches.some((m) => m.scoreA === null || m.scoreB === null) && (
              <button
                type="button"
                onClick={() => fillKnockoutRound('third_place')}
                className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
              >
                Fill 3rd Place (test)
              </button>
            )}
          </div>
          <div className="max-w-md">
            {thirdPlaceMatches.map((m) => {
              const pa = playerMap.get(m.playerAId)
              const pb = playerMap.get(m.playerBId)
              if (!pa || !pb) return null
              return <MatchCard key={m.id} match={m} playerA={pa} playerB={pb} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}
