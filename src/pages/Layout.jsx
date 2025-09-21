

import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Wallet, TrendingUp, Settings, BookOpen } from "lucide-react"; // Added BookOpen import
import { Button } from "@/components/ui/button";

export default function Layout({ children }) {
  // NOTE: Wallet connection logic is now managed within the Dashboard page.
  // This layout is a simple wrapper with a consistent header.
  return (
    <div className="min-h-screen bg-gray-900">
      <style jsx>{`
        :root {
          --bg-primary: #0F172A;
          --bg-secondary: #1E293B;
          --accent-primary: #06B6D4;
          --accent-secondary: #8B5CF6;
          --text-primary: #F1F5F9;
          --text-secondary: #94A3B8;
        }
      `}</style>
      
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-white">ProofBet</h2>
              <p className="text-xs text-gray-400">Decentralized Betting</p>
            </div>
          </Link>
          
          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                Markets
              </Button>
            </Link>
            {/* New Documentation Link */}
            <Link to={createPageUrl("Documentation")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <BookOpen className="w-4 h-4 mr-2" />
                Docs
              </Button>
            </Link>
            <Link to={createPageUrl("Admin")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

