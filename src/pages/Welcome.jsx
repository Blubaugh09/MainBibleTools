import { Link } from 'react-router-dom';
import Chat from '../components/Chat';

const Welcome = () => {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full">
      {/* Left side - Welcome and auth buttons */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to Bible Tools</h1>
          <p className="text-gray-600 mb-8 text-lg">Your companion for studying the Bible</p>
          
          <div className="space-y-4 mb-8">
            <Link 
              to="/login" 
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              Login
            </Link>
            <Link 
              to="/signup" 
              className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
      
      {/* Right side - Chat */}
      <div className="w-full md:w-1/2 bg-gray-100 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Ask Bible Assistant</h2>
          <Chat />
        </div>
      </div>
    </div>
  );
};

export default Welcome; 