import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function SearchBar({ onSearch, onReset }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [minYesVotes, setMinYesVotes] = useState("");
  const [maxYesVotes, setMaxYesVotes] = useState("");
  const [minNoVotes, setMinNoVotes] = useState("");
  const [maxNoVotes, setMaxNoVotes] = useState("");
  const [status, setStatus] = useState("");

  const handleSearch = () => {
    const filters = {
      contains_title: searchTerm || undefined,
      sort: `${sortField}:${sortOrder}`,
      min_yesVotes: minYesVotes || undefined,
      max_yesVotes: maxYesVotes || undefined,
      min_noVotes: minNoVotes || undefined,
      max_noVotes: maxNoVotes || undefined,
      status: status || undefined,
    };
    onSearch(filters);
  };

  const handleReset = () => {
    setSearchTerm("");
    setSortField("createdAt");
    setSortOrder("desc");
    setMinYesVotes("");
    setMaxYesVotes("");
    setMinNoVotes("");
    setMaxNoVotes("");
    setStatus("");
    onReset();
  };

  const hasFilters = searchTerm || minYesVotes || maxYesVotes || minNoVotes || maxNoVotes || status;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <Select value={sortField} onValueChange={setSortField}>
          <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600 text-white">
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="totalStake">Total Stake</SelectItem>
            <SelectItem value="bettingDeadline">Betting Deadline</SelectItem>
            <SelectItem value="participantCount">Participants</SelectItem>
            <SelectItem value="yesVotes">Yes Votes</SelectItem>
            <SelectItem value="noVotes">No Votes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[140px] bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600 text-white">
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-gray-600 bg-gray-700 hover:bg-gray-600 text-white">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Advanced Filters
              {hasFilters && <span className="ml-2 w-2 h-2 bg-cyan-400 rounded-full" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 border-gray-700 text-white" align="end">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value={null}>All</SelectItem>
                    <SelectItem value="0">Open for Bets</SelectItem>
                    <SelectItem value="1">Awaiting Proof</SelectItem>
                    <SelectItem value="2">Voting</SelectItem>
                    <SelectItem value="3">Completed</SelectItem>
                    <SelectItem value="4">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Yes Votes Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minYesVotes}
                    onChange={(e) => setMinYesVotes(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxYesVotes}
                    onChange={(e) => setMaxYesVotes(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">No Votes Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minNoVotes}
                    onChange={(e) => setMinNoVotes(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxNoVotes}
                    onChange={(e) => setMaxNoVotes(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>

        {hasFilters && (
          <Button onClick={handleReset} variant="ghost" className="text-gray-400 hover:text-white">
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}