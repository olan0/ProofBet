import React from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DocumentationLink({ className = "", variant = "ghost", size = "sm" }) {
  return (
    <Link to={createPageUrl("Documentation")}>
      <Button variant={variant} size={size} className={className}>
        <BookOpen className="w-4 h-4 mr-2" />
        Documentation
      </Button>
    </Link>
  );
}