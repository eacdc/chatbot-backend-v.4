import React from "react";

const LogoutPopup = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-5 rounded-lg shadow-lg">
        <p className="text-lg font-semibold mb-4">Do you want to log out?</p>
        <div className="flex justify-between">
          <button
            onClick={onConfirm}
            className="bg-red-500 text-white px-4 py-2 rounded-lg"
          >
            Yes
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-300 px-4 py-2 rounded-lg"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutPopup;
