
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";

// An array to map the category enum (number) from the contract to a string
const CATEGORY_MAP = ["Politics", "Sports", "Tech", "Crypto", "Other"];
// CORRECTED STATUS MAPPING TO MATCH THE CONTRACT
const STATUS_MAP = ["Open", "Awaiting Proof", "Voting", "Resolved", "Cancelled"];

export default function BetCard({ bet }) {
  const categoryName = CATEGORY_MAP[bet.category] || "Other";
  const statusName = STATUS_MAP[bet.status] || "Unknown";

  const getStatusColor = () => {
    switch (statusName) {
      case "Open":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Awaiting Proof":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "Voting":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Resolved":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getCategoryColor = () => {
    switch (categoryName) {
      case "Politics":
        return "bg-red-500/20 text-red-300 border-red-500/50";
      case "Sports":
        return "bg-orange-500/20 text-orange-300 border-orange-500/50";
      case "Tech":
        return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      case "Crypto":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/50";
    }
  };
  
  // The contract provides timestamps in seconds, so we multiply by 1000 for JavaScript's Date object
  const creationDate = new Date(Number(bet.creationTimestamp) * 1000);
  const timeAgo = formatDistanceToNow(creationDate, { addSuffix: true });

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col h-full bg-gray-800/50 border-gray-700 text-white">
      <CardHeader>
        <div className="flex justify-between items-start">
            <Badge className={getStatusColor()}>{statusName}</Badge>
            <Badge className={getCategoryColor()}>{categoryName}</Badge>
        </div>
        <CardTitle className="mt-2">{bet.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-gray-300 line-clamp-3">
          {bet.description}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-sm text-gray-300">
        <span>{timeAgo}</span>
        {/* IMPORTANT: The link now uses the bet's contract address as the identifier */}
        <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
          <Button variant="outline" size="sm" className="border-gray-600 hover:bg-gray-700">View Details</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
