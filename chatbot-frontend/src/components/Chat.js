import React, { useState } from "react";
import axios from "axios";

const Chat = () => {
  const [chatHistory, setChatHistory] = useState([]);

  return (
    <div
      style={{
        maxHeight: "300px",
        overflowY: "auto",
        backgroundColor: "#f3f4f6", // Light gray background
        borderRadius: "8px",
        padding: "10px",
      }}
    >
      {chatHistory.map((msg, index) => (
        <p
          key={index}
          style={{
            textAlign: msg.role === "user" ? "right" : "left",
            backgroundColor: msg.role === "user" ? "#d1e7fd" : "#e2e8f0",
            padding: "8px 12px",
            borderRadius: "10px",
            display: "inline-block",
            maxWidth: "70%",
            marginBottom: "6px",
          }}
        >
          {msg.content}
        </p>
      ))}
    </div>
  );
};

export default Chat;
