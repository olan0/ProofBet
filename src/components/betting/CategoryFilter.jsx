import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "tech", label: "Tech" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" }
];

export default function CategoryFilter({ selectedCategory, onCategoryChange }) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-gray-400" />
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-700 text-white">
          {categories.map(category => (
            <SelectItem key={category.value} value={category.value} className="focus:bg-gray-700">
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}