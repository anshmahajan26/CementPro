import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

const DashboardChatbot = ({ dashboardData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your AI Analyst. I have full access to your current forecasting, procurement, and carbon footprint data. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setIsLoading(true);

    try {
      // Send question and current dashboard context to backend
      const response = await api.post("/dashboard/chat", {
        question: userText,
        contextData: {
          kpis: dashboardData.kpis,
          alerts: dashboardData.alerts,
          insights: dashboardData.insights,
          stakeholder_summary: dashboardData.stakeholder_summary
        }
      });

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: response.data.answer }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: error.response?.data?.message || "Sorry, I encountered an error analyzing the data. Please try again.",
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 p-0 flex items-center justify-center z-40 transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>

      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-80 sm:w-96 shadow-2xl z-50 flex flex-col border-blue-200 overflow-hidden" style={{ height: "500px", maxHeight: "calc(100vh - 120px)" }}>
          <CardHeader className="bg-blue-600 text-white p-3 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-100" />
              <CardTitle className="text-base font-bold text-white">AI Analyst Assistant</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white hover:bg-blue-700 h-8 w-8 p-0 rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-slate-50">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm flex gap-2 ${
                    msg.role === "user" 
                      ? "bg-blue-600 text-white rounded-br-none" 
                      : msg.isError 
                        ? "bg-red-100 text-red-900 border border-red-200" 
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm"
                  }`}>
                    {msg.role === "assistant" && <Bot className={`h-4 w-4 shrink-0 mt-0.5 ${msg.isError ? "text-red-500" : "text-blue-500"}`} />}
                    <div className={`leading-relaxed w-full ${msg.role === "assistant" ? "prose prose-sm prose-slate prose-p:my-1 prose-ul:my-1 prose-h3:text-sm prose-h4:text-sm prose-p:leading-relaxed prose-li:leading-relaxed dark:prose-invert break-words max-w-full" : "whitespace-pre-wrap flex items-center"}`}>
                      {msg.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-lg rounded-bl-none py-3 px-4 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-xs text-slate-500">Analyzing data...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2 shrink-0 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your metrics..."
                className="flex-1 bg-slate-50"
                disabled={isLoading}
              />
              <Button type="submit" disabled={!input.trim() || isLoading} size="icon" className="bg-blue-600 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default DashboardChatbot;
