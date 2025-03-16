"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Club = {
  id: number
  name: string
  logo_url: string | null
}

export default function SelectClubPage() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const { data, error } = await supabase.from("clubs").select("id, name, logo_url").order("name")

        if (error) {
          throw error
        }

        setClubs(data || [])
      } catch (error: any) {
        console.error("Error fetching clubs:", error)
        setError("Failed to load clubs. Please try again.")
      }
    }

    fetchClubs()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClub) {
      setError("Please select a club")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session || !session.user) {
        throw new Error("You must be logged in to select a club")
      }

      const userId = session.user.id

      // First check if the profile exists
      const { data: existingProfile } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          club_id: selectedClub.id,
          updated_at: new Date().toISOString(),
        })

        if (insertError) throw insertError
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            club_id: selectedClub.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)

        if (updateError) throw updateError
      }

      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error selecting club:", error)
      setError(error.message || "An error occurred while selecting your club")
    } finally {
      setLoading(false)
    }
  }

  const filteredClubs =
    search === "" ? clubs : clubs.filter((club) => club.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Select Your Club</CardTitle>
          <CardDescription>Choose the football club you represent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="club">Club</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {selectedClub ? selectedClub.name : "Select a club..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search clubs..." value={search} onValueChange={setSearch} />
                    <CommandList>
                      <CommandEmpty>No clubs found.</CommandEmpty>
                      <CommandGroup>
                        {filteredClubs.map((club) => (
                          <CommandItem
                            key={club.id}
                            value={club.name}
                            onSelect={() => {
                              setSelectedClub(club)
                              setOpen(false)
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", selectedClub?.id === club.id ? "opacity-100" : "opacity-0")}
                            />
                            {club.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

