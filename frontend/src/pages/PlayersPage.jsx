import React from 'react';
import TeamPlayersShowcase from '../components/TeamPlayersShowcase';

export default function PlayersPage({ isAdmin }) {
  return (
    <div className="min-h-screen bg-volleyball-darker pb-24">
    <TeamPlayersShowcase isAdmin={isAdmin} />
    </div>
  );
}
