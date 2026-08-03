"use client";

import React, { useState } from "react";

export default function ScheduleForm({ initialDisabled = false }: { initialDisabled?: boolean }) {
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!content.trim() || !scheduledFor) {
      setMessage("Please provide content and scheduled time.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, scheduled_for: scheduledFor })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Failed to schedule post");
      } else {
        setMessage("Post scheduled successfully");
        setContent("");
        setScheduledFor("");
        // Optionally refresh the page to show new post — simple approach:
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
      <label className="block">
        <span className="text-sm font-medium">Post content</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm"
          placeholder="Write something to post to LinkedIn..."
          maxLength={1300}
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Schedule for</span>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm"
          required
        />
      </label>

      {message && <div className="text-sm text-red-600">{message}</div>}

      <button
        type="submit"
        disabled={initialDisabled || loading}
        className={`px-4 py-2 rounded text-white ${initialDisabled ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {loading ? "Scheduling..." : "Schedule Post"}
      </button>
    </form>
  );
}
