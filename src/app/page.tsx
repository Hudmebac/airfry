'use client';

import {IdentifyFoodOutput, identifyFood} from '@/ai/flows/identify-food';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {toast} from '@/hooks/use-toast';
import {CameraIcon, UploadIcon, RefreshCwIcon, Loader2, SearchIcon, RotateCcwIcon, Info, Star, StarOff, History, Share2, Copy} from 'lucide-react';
import Image from 'next/image';
import {useRef, useState, useEffect, useCallback} from 'react';
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { generateCookingInstructions } from '@/ai/flows/generate-cooking-instructions';
import {
  Dialog as ShareDialog,
  DialogTrigger as ShareDialogTrigger,
  DialogContent as ShareDialogContent,
  DialogHeader as ShareDialogHeader,
  DialogTitle as ShareDialogTitle,
  DialogDescription as ShareDialogDescription
} from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {Textarea} from '@/components/ui/textarea';
import {Mic, HelpCircle} from 'lucide-react';

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cookingInfo, setCookingInfo] = useState<IdentifyFoodOutput | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);
  const [identificationError, setIdentificationError] = useState<string | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const timerAudioRef = useRef<HTMLAudioElement | null>(null);
  const [manualFoodName, setManualFoodName] = useState('');
  const [foodHistory, setFoodHistory] = useState<{ name: string; favorite: boolean }[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [sharePlatform, setSharePlatform] = useState<'facebook' | 'whatsapp' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Add a mapping of food keywords to specific tips
  const foodTips: Record<string, string> = {
    chicken: "For juicy chicken, let it rest a few minutes after air frying before cutting.",
    wings: "Toss wings in sauce after air frying for best crispiness.",
    fries: "Shake the basket halfway through for evenly crispy fries.",
    fish: "Lightly oil fish to prevent sticking and keep it moist.",
    steak: "Let steak come to room temperature before air frying for even cooking.",
    bacon: "Lay bacon strips in a single layer for maximum crispiness.",
    vegetables: "Cut veggies evenly for uniform cooking.",
    shrimp: "Don\'t overcrowd shrimp for best results.",
    pizza: "Reheat pizza in the air fryer for a crispy crust.",
    tofu: "Press tofu before air frying for extra crispiness.",
  };

  // Function to get a tip based on the current food name
  function getCookingTip(foodName?: string) {
    if (!foodName) return 'For best results, avoid overcrowding your air fryer basket!';
    const lower = foodName.toLowerCase();
    for (const key in foodTips) {
      if (lower.includes(key)) return foodTips[key];
    }
    return 'For best results, avoid overcrowding your air fryer basket!';
  }

  useEffect(() => {
    setCookingInfo(null);
    setIdentificationError(null);
  }, [imageUrl]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('airfryer_food_history');
    if (stored) {
      setFoodHistory(JSON.parse(stored));
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('airfryer_food_history', JSON.stringify(foodHistory));
  }, [foodHistory]);

  // Add food to history (and optionally favorite)
  const addFoodToHistory = useCallback((name: string, favorite = false) => {
    setFoodHistory(prev => {
      // Remove if already exists (case-insensitive)
      let filtered = prev.filter(f => f.name.toLowerCase() !== name.toLowerCase());
      // Add to top
      filtered = [{ name, favorite }, ...filtered];
      // If favorited, move to top and set favorite
      if (favorite) {
        filtered = [
          { name, favorite: true },
          ...filtered.filter(f => f.name.toLowerCase() !== name.toLowerCase())
        ];
      }
      // Limit to 10 items, but always keep all favorites
      const favorites = filtered.filter(f => f.favorite);
      const recents = filtered.filter(f => !f.favorite).slice(0, 10 - favorites.length);
      return [...favorites, ...recents];
    });
  }, []);

  // When instructions are shown, add to history
  useEffect(() => {
    if (cookingInfo?.foodName) {
      addFoodToHistory(cookingInfo.foodName);
    }
  }, [cookingInfo]);

  // Toggle favorite
  const toggleFavorite = useCallback((name: string) => {
    setFoodHistory(prev => prev.map(f => f.name === name ? { ...f, favorite: !f.favorite } : f));
  }, []);

  // Handle click on history/favorite
  const handleHistoryClick = useCallback(async (name: string) => {
    setManualFoodName(name);
    setIsLoadingInstructions(true);
    setCookingInfo(null);
    setIdentificationError(null);
    try {
      const result = await generateCookingInstructions({ foodName: name });
      setCookingInfo({
        foodName: name,
        cookingTimeMinutes: parseInt(result.cookingTime, 10),
        cookingTemperatureCelsius: result.cookingTemperatureCelsius,
        identificationConfidence: 100,
        calorieEstimate: result.calorieEstimate,
        menuSuggestions: result.menuSuggestions,
        drinkSuggestion: result.drinkSuggestion,
      });
    } catch (e: any) {
      setIdentificationError(e.message || 'Could not get instructions for this food.');
      toast({
        title: 'Error',
        description: 'Failed to get cooking instructions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInstructions(false);
    }
  }, []);

  const initializeCamera = useCallback(async (requestedDeviceId: string | null = null) => {
    if (isCameraInitializing) return;
    console.log(`Initializing camera. Requested device: ${requestedDeviceId}`);
    setIsCameraInitializing(true);

    let streamToSet: MediaStream | null = null;
    let finalDeviceId: string | null = null;
    let permissionGranted = false;

    try {
      // 1. Stop previous stream if any
      mediaStream?.getTracks().forEach(track => track.stop());

      // 2. Request permission and get initial stream
      try {
        streamToSet = await navigator.mediaDevices.getUserMedia({ video: true });
        permissionGranted = true;
        setHasCameraPermission(true);
      } catch (permError) {
        console.error('Error getting camera permission:', permError);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
        setIsCameraInitializing(false);
        return;
      }

      // 3. Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const availableVideoDevices = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(availableVideoDevices);

      if (availableVideoDevices.length === 0) {
        console.error('No video input devices found.');
        setHasCameraPermission(false); // Functionally no camera
        toast({
          variant: 'destructive',
          title: 'No Camera Found',
          description: 'No camera devices were detected.',
        });
        streamToSet?.getTracks().forEach(track => track.stop()); // Stop the stream we got
        setMediaStream(null);
        setIsCameraInitializing(false);
        return;
      }

      // 4. Determine target device ID
      let targetDeviceId: string | null = null;
      if (requestedDeviceId && availableVideoDevices.some(d => d.deviceId === requestedDeviceId)) {
        targetDeviceId = requestedDeviceId;
      } else {
        // Select default (prefer back, fallback to last)
        targetDeviceId = availableVideoDevices[availableVideoDevices.length - 1].deviceId;
        const backCamera = availableVideoDevices.find(device => device.label.toLowerCase().includes('back'));
        if (backCamera) {
          targetDeviceId = backCamera.deviceId;
        }
      }
      finalDeviceId = targetDeviceId;

      // 5. Get the specific stream if necessary
      const currentStreamDeviceId = streamToSet?.getVideoTracks()[0]?.getSettings()?.deviceId;
      if (currentStreamDeviceId !== targetDeviceId) {
        console.log(`Switching stream from ${currentStreamDeviceId} to ${targetDeviceId}`);
        streamToSet?.getTracks().forEach(track => track.stop()); // Stop the initial stream
        const specificConstraints: MediaStreamConstraints = {
          video: { deviceId: { exact: targetDeviceId } }
        };
        streamToSet = await navigator.mediaDevices.getUserMedia(specificConstraints);
      }

      // 6. Set state ONLY (Removed videoRef interaction)
      setMediaStream(streamToSet);
      setCurrentDeviceId(finalDeviceId);
      // Ensure permission state is accurate
      setHasCameraPermission(true);

    } catch (error) {
      console.error('Error during camera initialization steps:', error);
      setHasCameraPermission(false);
      setMediaStream(null);
      setCurrentDeviceId(null);
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Could not initialize the camera. Please ensure it is connected and permissions are granted.',
      });
    } finally {
      console.log("Camera initialization function finished.");
      setIsCameraInitializing(false);
    }
  }, [isCameraInitializing, mediaStream]);

  // useEffect for permission checking (no change needed here)
  useEffect(() => {
    const checkPermissions = async () => {
        console.log("Checking camera permissions...");
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
            console.log(`Initial permission state: ${permissionStatus.state}`);
            if (permissionStatus.state === 'granted') {
                 if (!mediaStream && !isCameraInitializing) { // Only initialize if no stream and not already initializing
                    console.log("Permission granted, initializing camera...");
                    initializeCamera();
                 }
            } else {
                setHasCameraPermission(false);
            }

            permissionStatus.onchange = () => {
                console.log(`Permission state changed to: ${permissionStatus.state}`);
                if (permissionStatus.state === 'granted') {
                    if (!isCameraInitializing) {
                         console.log("Permission granted via change, initializing camera...");
                         initializeCamera();
                    }
                } else {
                     setHasCameraPermission(false);
                     mediaStream?.getTracks().forEach(track => track.stop());
                     setMediaStream(null);
                     setCurrentDeviceId(null);
                }
            };
        } catch (error) {
            console.error("Camera permission query failed:", error);
            setHasCameraPermission(false); // Assume denied if query fails
        }
     };
     checkPermissions();

     // Cleanup on unmount
     return () => {
        console.log("Cleanup: Stopping media stream.");
        mediaStream?.getTracks().forEach(track => track.stop());
    };
  }, [initializeCamera, isCameraInitializing]);

  // NEW useEffect hook to handle video playback when mediaStream changes
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      console.log("MediaStream updated, setting srcObject and playing video.");
      videoRef.current.srcObject = mediaStream;
      videoRef.current.muted = true; // Ensure muted for autoplay
      videoRef.current.play().catch(playError => {
        console.error("Video play failed in useEffect:", playError);
        // Handle potential autoplay restrictions if necessary
      });
    } else {
         console.log("useEffect for playback: videoRef or mediaStream not ready.");
    }
  }, [mediaStream]); // Run only when mediaStream changes

  // Define requestCameraPermission before it's used in JSX
  const requestCameraPermission = useCallback(() => {
    if (!isCameraInitializing) {
        console.log("Requesting camera permission explicitly...");
        initializeCamera(); // Attempt to initialize (which includes getUserMedia)
    }
  }, [initializeCamera, isCameraInitializing]);

  const switchCamera = useCallback(async () => {
    if (videoDevices.length < 2 || !currentDeviceId || isCameraInitializing) return;
    console.log("Attempting to switch camera...");
    const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDeviceId = videoDevices[nextIndex].deviceId;
    console.log(`Switching to device: ${nextDeviceId}`);
    await initializeCamera(nextDeviceId); // Use the refactored function

  }, [videoDevices, currentDeviceId, initializeCamera, isCameraInitializing]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageUrl(result);
        setCookingInfo(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const takeSnapshot = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      const dataUrl = canvas.toDataURL('image/png');
      setImageUrl(dataUrl);
      setCookingInfo(null);
    }
  }, []);

  const handleUnifiedGetInstructions = useCallback(async () => {
    const foodName = manualFoodName.trim();
    if (!foodName && !imageUrl) {
      toast({
        title: 'Info',
        description: 'Please upload a photo or enter a food name.',
        variant: 'default',
      });
      return;
    }
    setIsLoadingInstructions(true);
    setCookingInfo(null);
    setIdentificationError(null);
    try {
      if (foodName) {
        const result = await generateCookingInstructions({ foodName });
        setCookingInfo({
          foodName,
          cookingTimeMinutes: parseInt(result.cookingTime, 10),
          cookingTemperatureCelsius: result.cookingTemperatureCelsius,
          identificationConfidence: 100,
          calorieEstimate: result.calorieEstimate,
          menuSuggestions: result.menuSuggestions,
          drinkSuggestion: result.drinkSuggestion,
        });
      } else if (imageUrl) {
        const result = await identifyFood({ photoUrl: imageUrl });
        if (result && 'foodName' in result && result.foodName) {
          setCookingInfo(result);
        } else {
          setIdentificationError((result as any)?.message || 'Could not identify the food. Please try taking another photo with better lighting or a clearer view.');
          toast({
            title: 'Identification Failed',
            description: 'Please try another photo.',
            variant: 'destructive',
          });
        }
      }
    } catch (e: any) {
      setIdentificationError(e.message || 'Could not get instructions for this food.');
      toast({
        title: 'Error',
        description: 'Failed to get cooking instructions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [manualFoodName, imageUrl, setIsLoadingInstructions, setCookingInfo, setIdentificationError, toast]);

  const handleRestart = useCallback(() => {
    setImageUrl(null);
    setCookingInfo(null);
    setIdentificationError(null);
    // No need to re-init camera here, the view will update based on state
  }, []);

  // Start timer with the given minutes
  const handleStartTimer = useCallback(() => {
    if (cookingInfo?.cookingTimeMinutes) {
      setTimerSeconds(cookingInfo.cookingTimeMinutes * 60);
      setTimerActive(true);
    }
  }, [cookingInfo]);

  // Pause timer
  const handlePauseTimer = useCallback(() => {
    setTimerActive(false);
  }, []);

  // Resume timer
  const handleResumeTimer = useCallback(() => {
    if (timerSeconds && timerSeconds > 0) {
      setTimerActive(true);
    }
  }, [timerSeconds]);

  // Reset timer
  const handleResetTimer = useCallback(() => {
    setTimerActive(false);
    setTimerSeconds(cookingInfo?.cookingTimeMinutes ? cookingInfo.cookingTimeMinutes * 60 : null);
  }, [cookingInfo]);

  // Timer countdown effect
  useEffect(() => {
    if (timerActive && timerSeconds && timerSeconds > 0) {
      timerInterval.current = setInterval(() => {
        setTimerSeconds((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (!timerActive && timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [timerActive, timerSeconds]);

  // Request notification permission when timer starts
  useEffect(() => {
    if (timerActive && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [timerActive]);

  // Stop timer at 0 and play sound, show notification
  useEffect(() => {
    if (timerSeconds === 0) {
      setTimerActive(false);
      // Play sound when timer finishes
      if (timerAudioRef.current) {
        timerAudioRef.current.currentTime = 0;
        timerAudioRef.current.play();
      }
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Air Fryer Timer', {
          body: 'Your cooking timer is done!',
          icon: '/food-background.jpg',
        });
      }
    }
  }, [timerSeconds]);

  // Handler for manual food entry
  const handleManualFoodSubmit = useCallback(async () => {
    if (!manualFoodName.trim()) return;
    setIsLoadingInstructions(true);
    setCookingInfo(null);
    setIdentificationError(null);
    try {
      const result = await generateCookingInstructions({ foodName: manualFoodName.trim() });
      // Adapt result to IdentifyFoodOutput shape for display
      setCookingInfo({
        foodName: manualFoodName.trim(),
        cookingTimeMinutes: parseInt(result.cookingTime, 10),
        cookingTemperatureCelsius: result.cookingTemperatureCelsius,
        identificationConfidence: 100,
        calorieEstimate: result.calorieEstimate,
        menuSuggestions: result.menuSuggestions,
        drinkSuggestion: result.drinkSuggestion,
      });
    } catch (e: any) {
      setIdentificationError(e.message || 'Could not get instructions for this food.');
      toast({
        title: 'Error',
        description: 'Failed to get cooking instructions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [manualFoodName]);

  // Generate dynamic share message
  const getShareMessage = () => {
    if (!cookingInfo) return '';
    let msg = `I'm cooking ${cookingInfo.foodName} in the air fryer:`;
    if (cookingInfo.cookingTimeMinutes) {
      msg += ` only ${cookingInfo.cookingTimeMinutes} minutes to wait.`;
    }
    // Menu suggestions
    if (cookingInfo.menuSuggestions && cookingInfo.menuSuggestions.length > 0) {
      msg += ` The suggested choices to serve this with are ${cookingInfo.menuSuggestions.join(', ')}`;
    }
    // Drink suggestion
    if (cookingInfo.drinkSuggestion) {
      msg += `${cookingInfo.menuSuggestions && cookingInfo.menuSuggestions.length > 0 ? ',' : ''} and the Drink pairing of ${cookingInfo.drinkSuggestion}.`;
    }
    msg += `\n#AirFry \nLink: airfry.netlify.app`;
    return msg;
  };

  // Handle share button click
  const handleShareClick = () => {
    setShareMessage(getShareMessage());
    setShareOpen(true);
  };

  // Handle Facebook share approval
  const handleFacebookShare = async () => {
    await navigator.clipboard.writeText(shareMessage);
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://airfry.netlify.app/')}`;
    window.open(url, '_blank');
    toast({ 
      title: 'Copied! Ready to Share', 
      description: 'Facebook does not allow apps to pre-fill post text. When the Facebook window opens, simply click in the post box and paste (Ctrl+V or right-click > Paste) the message you copied.' 
    });
    setShareOpen(false);
  };

  // Handle WhatsApp share
  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
    setShareOpen(false);
  };

  // Handle copy to clipboard
  const handleCopyShare = async () => {
    await navigator.clipboard.writeText(shareMessage);
    toast({ title: 'Copied!', description: 'Message copied to clipboard.' });
    setShareOpen(false);
  };

  // Speech-to-text logic
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.interimResults = false;
        recognitionRef.current.maxAlternatives = 1;
        recognitionRef.current.continuous = false; // Stop after a pause
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setManualFoodName(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognitionRef.current.onend = () => {
          setIsListening(false);
          handleUnifiedGetInstructions(); // Auto-search after speech ends
        };
        recognitionRef.current.onerror = () => setIsListening(false);
      }
    }
  }, [handleUnifiedGetInstructions]);

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-background">
      {/* Hidden audio element for timer sound */}
      <audio ref={timerAudioRef} src="/timer-done.mp3" preload="auto" />
      <Card className="w-full max-w-4xl rounded-2xl shadow-2xl border-2 border-primary/30 bg-card/80 backdrop-blur-md">
        <CardHeader className="text-center flex flex-col items-center gap-2 relative">
          <Image src="/airfryerlogo.png" alt="Airfryer logo" width={48} height={48} className="mx-auto" />
          <h1 className="text-3xl font-extrabold text-orange-500 drop-shadow-md flex items-center justify-center gap-2 mt-2">
            <span role="img" aria-label="fire" className="animate-pulse">🔥</span>
            Air Fry Tool
            <span role="img" aria-label="fire" className="animate-pulse">🔥</span>
          </h1>
          <a href="/airfryer-info" className="mt-4 inline-block px-6 py-2 rounded-full bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition-all text-lg">
            Learn About Air Frying
          </a>
          {/* Info Button */}
          <div className="absolute top-2 right-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Info">
                  <Info className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>How to Use</DialogTitle>
                  <DialogDescription>
                    <ul className="list-disc pl-5 space-y-1 text-left mt-2">
                      <li>Take or upload a photo of your food using the camera or upload button.</li>
                      <li>Click "Get Cooking Instructions" to receive air fryer time and temperature.</li>
                      <li>Optionally, start a timer for the recommended cooking time.</li>
                      <li>Browse suggested menu pairings and calorie info if available.</li>
                    </ul>
                    <hr className="my-4" />
                    <div className="text-left">
                      <h3 className="font-semibold mb-1">About This App</h3>
                      <p className="mb-2">The Air Fryer App is a simple web application designed to help users find cooking times and temperatures for various food items using an air fryer. The app allows users to snap a photo of their food, upload images, and browse through a categorized list of food items.</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Camera Functionality: Take a photo of your food using the device's camera.</li>
                        <li>Image Upload: Upload images of food items for identification.</li>
                        <li>Food Database: Comprehensive database of food items with cooking times and temperatures.</li>
                        <li>Group Selection: Select food categories to filter the displayed items.</li>
                        <li>Responsive Design: Works on both desktop and mobile devices.</li>
                      </ul>
                      <div className="mt-3 text-sm font-semibold text-muted-foreground text-center">
                        Creator: Craig Heggie<br/>
                        <span className="block">&copy; {new Date().getFullYear()} Craig Heggie. All rights reserved.</span>
                        <a href="https://airfry.netlify.app/" className="underline block mt-1" target="_blank" rel="noopener noreferrer">https://airfry.netlify.app/</a>
                      </div>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          <div className="flex flex-col space-y-4">
            <div className="border-2 border-secondary/40 rounded-xl overflow-hidden relative aspect-square bg-muted flex items-center justify-center shadow-md">
              {imageUrl ? (
                <Image src={imageUrl} alt="Uploaded Food" layout="fill" objectFit="cover" className="transition-all duration-300" />
              ) : (
                <>
                  {hasCameraPermission !== false && (
                    <video
                       ref={videoRef}
                       className={`w-full h-full object-cover ${isCameraInitializing ? 'opacity-50' : ''}`}
                       autoPlay
                       muted
                       playsInline
                     />
                  )}
                  {(isCameraInitializing || (hasCameraPermission === true && !mediaStream)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
                       <Alert variant="destructive" className="max-w-sm text-center">
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription className="mb-3">
                                Please allow camera access in your browser settings or click below to request it again.
                            </AlertDescription>
                            <Button onClick={requestCameraPermission} variant="secondary" disabled={isCameraInitializing}>
                                {isCameraInitializing ? "Requesting..." : "Request Camera Access"}
                            </Button>
                        </Alert>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-2">
                 <Input
                    type="file"
                    id="photoUrl"
                    name="photoUrl"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    />
                 <label htmlFor="photoUrl">
                    <Button asChild variant="outline" className="border-secondary/60" disabled={isCameraInitializing}>
                        <span className="flex items-center">
                        <UploadIcon className="h-4 w-4 mr-2" />
                        {imageUrl ? 'Change Image' : 'Upload Image'}
                        </span>
                    </Button>
                 </label>
                 {!imageUrl && hasCameraPermission === true && mediaStream && (
                     <>
                        <Button variant="secondary" onClick={takeSnapshot} className="border-secondary/60" disabled={isCameraInitializing}>
                            <CameraIcon className="h-4 w-4 mr-2" />
                            Take Photo
                        </Button>
                        {videoDevices.length > 1 && (
                            <Button variant="outline" size="icon" onClick={switchCamera} title="Switch Camera" className="border-muted-foreground/40" disabled={isCameraInitializing}>
                                <RefreshCwIcon className="h-4 w-4" />
                            </Button>
                        )}
                     </>
                 )}
                 {imageUrl && (
                    <Button variant="outline" size="icon" onClick={handleRestart} title="Restart" className="border-muted-foreground/40" disabled={isCameraInitializing}>
                        <RotateCcwIcon className="h-4 w-4" />
                    </Button>
                 )}
             </div>
          </div>

          <div className="flex flex-col space-y-6">
            {/* Manual Food Name Input Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">Type or Speak Food Name</span>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="How to use food input">
                        <HelpCircle className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs text-sm">
                        <div>
                          Type or use the microphone to enter a food name.<br/>
                          Example: <span className="italic">chicken wings</span>
                        </div>
                        <div className="mt-2">
                          After using the microphone, you can:
                          <ul className="list-disc pl-5 mt-1">
                            <li>Edit the food name by typing</li>
                            <li>Add more by using the microphone again</li>
                            <li>Use the reset button to clear the input</li>
                          </ul>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">You can also upload or take a photo instead.</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Textarea
                  value={manualFoodName}
                  onChange={e => setManualFoodName(e.target.value)}
                  placeholder="e.g. chicken wings"
                  rows={1}
                  className="resize-y min-h-[48px] max-h-40"
                />
                <Button
                  type="button"
                  size="icon"
                  variant={isListening ? 'secondary' : 'outline'}
                  onClick={handleMicClick}
                  aria-label={isListening ? 'Stop listening' : 'Speak food name'}
                >
                  <Mic className={`h-5 w-5 ${isListening ? 'animate-pulse text-primary' : ''}`} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setManualFoodName('')}
                  aria-label="Reset food name input"
                  disabled={!manualFoodName}
                >
                  <RotateCcwIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Get Instructions Button, History, Share, Results, Cooking Tip */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full flex justify-center">
                        <Button
                            onClick={handleUnifiedGetInstructions}
                            size="lg"
                            variant="default"
                            className="rounded-full px-8 py-4 text-lg font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                            disabled={(!imageUrl && !manualFoodName.trim()) || isLoadingInstructions || isCameraInitializing}
                            aria-label="Get Cooking Instructions"
                        >
                            {isLoadingInstructions ? (
                                <><Loader2 className="h-6 w-6 animate-spin mr-2" /> Searching Heggster Cookbook…</>
                            ) : (
                                <span className="flex items-center gap-2"><SearchIcon className="h-6 w-6" /> Get Cooking Instructions</span>
                            )}
                        </Button>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Get Cooking Instructions</p>
                    </TooltipContent>
                </Tooltip>

                <Separator />

                {/* Favorites/History */}
                {foodHistory.length > 0 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="recent-fav">
                      <AccordionTrigger className="flex items-center gap-2 mb-1 px-0 py-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-semibold">Recent & Favorite Foods</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ScrollArea className="max-h-40 w-full pr-2">
                          <div className="flex flex-wrap gap-2">
                            {foodHistory.slice(0, 10).map(f => (
                              <div key={f.name} className="flex items-center gap-1 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-secondary/80 transition"
                                onClick={() => handleHistoryClick(f.name)}
                                tabIndex={0}
                                aria-label={`Get instructions for ${f.name}`}
                                onKeyDown={e => { if (e.key === 'Enter') handleHistoryClick(f.name); }}
                              >
                                <span className="font-medium text-sm">{f.name}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="p-1"
                                  onClick={e => { e.stopPropagation(); toggleFavorite(f.name); }}
                                  aria-label={f.favorite ? `Unfavorite ${f.name}` : `Favorite ${f.name}`}
                                  tabIndex={-1}
                                >
                                  {f.favorite ? <Star className="h-4 w-4 text-yellow-400 fill-yellow-300" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {/* Share Button and Dialog */}
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={handleShareClick} aria-label="Share Cooking Instructions">
                    <Share2 className="h-4 w-4 mr-1" /> Share
                  </Button>
                </div>
                <ShareDialog open={shareOpen} onOpenChange={setShareOpen}>
                  <ShareDialogContent>
                    <ShareDialogHeader>
                      <ShareDialogTitle>Share Your Meal</ShareDialogTitle>
                      <div className="text-sm text-muted-foreground">
                        <span className="mb-2 block">Choose how you want to share your meal and instructions:</span>
                        <div className="flex flex-col gap-2">
                          <Button variant="secondary" onClick={() => setSharePlatform('facebook')}>
                            Share on Facebook
                          </Button>
                          <Button variant="secondary" onClick={() => setSharePlatform('whatsapp')}>
                            Share on WhatsApp
                          </Button>
                          <Button variant="outline" onClick={handleCopyShare}>
                            <Copy className="h-4 w-4 mr-1" /> Copy to Clipboard
                          </Button>
                        </div>
                        {sharePlatform === 'facebook' && (
                          <div className="mt-4">
                            <div className="font-semibold mb-1">Facebook Post Preview:</div>
                            <textarea
                              className="w-full border rounded p-2 text-sm"
                              rows={4}
                              value={shareMessage}
                              onChange={e => setShareMessage(e.target.value)}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button variant="default" onClick={handleFacebookShare}>Approve & Share</Button>
                              <Button variant="ghost" onClick={() => setSharePlatform(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                        {sharePlatform === 'whatsapp' && (
                          <div className="mt-4">
                            <div className="font-semibold mb-1">WhatsApp Message Preview:</div>
                            <textarea
                              className="w-full border rounded p-2 text-sm"
                              rows={4}
                              value={shareMessage}
                              onChange={e => setShareMessage(e.target.value)}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button variant="default" onClick={handleWhatsAppShare}>Send to WhatsApp</Button>
                              <Button variant="ghost" onClick={() => setSharePlatform(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </ShareDialogHeader>
                  </ShareDialogContent>
                </ShareDialog>

                <div className="p-4 border-2 border-secondary/30 rounded-2xl bg-background shadow-lg min-h-[220px] flex flex-col justify-center gap-2">
                  <h2 className="text-2xl font-extrabold text-primary text-center mb-4 tracking-tight flex items-center justify-center gap-2">
                    🍽️ Cooking Results
                  </h2>
                  {isLoadingInstructions ? (
                    <p className="text-center text-muted-foreground text-lg font-medium">Checking the cookbook...</p>
                  ) : identificationError ? (
                    <div className="text-center space-y-2">
                      <p className="text-destructive px-4 font-semibold text-lg">{identificationError}</p>
                      <p className="text-sm text-muted-foreground">(Confidence: 0%)</p>
                    </div>
                  ) : cookingInfo ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-muted/60 border border-secondary/40 p-3 flex flex-col items-center shadow-sm">
                        <h3 className="text-xl font-bold text-primary text-center flex items-center gap-2 mb-1">{cookingInfo.foodName} <span>🥘</span></h3>
                        {cookingInfo.identificationConfidence !== undefined && cookingInfo.identificationConfidence !== null && (
                          <p className="text-center text-sm text-secondary-foreground mb-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">Confidence: {cookingInfo.identificationConfidence}%</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Estimated confidence in food identification (0-100%).</p>
                              </TooltipContent>
                            </Tooltip>
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 flex flex-col items-center">
                          <span className="font-semibold text-primary text-lg">Time</span>
                          <span className="text-2xl font-mono font-bold text-foreground">{cookingInfo.cookingTimeMinutes} min</span>
                        </div>
                        <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 p-3 flex flex-col items-center">
                          <span className="font-semibold text-orange-700 dark:text-orange-300 text-lg">Temp</span>
                          <span className="text-2xl font-mono font-bold text-foreground">{cookingInfo.cookingTemperatureCelsius} °C</span>
                        </div>
                        {cookingInfo.calorieEstimate && (
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-3 flex flex-col items-center">
                            <span className="font-semibold text-green-700 dark:text-green-300 text-lg">Est. Calories</span>
                            <span className="text-xl font-mono font-bold text-foreground">{cookingInfo.calorieEstimate} kcal</span>
                          </div>
                        )}
                        {cookingInfo.drinkSuggestion && (
                          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 p-3 flex flex-col items-center">
                            <span className="font-semibold text-blue-700 dark:text-blue-300 text-lg">Drink Pairing</span>
                            <span className="text-base font-medium text-foreground">{cookingInfo.drinkSuggestion}</span>
                          </div>
                        )}
                      </div>
                      {typeof cookingInfo.cookingTimeMinutes === 'number' && (
                        <div className="mt-2 flex flex-col items-center">
                          {!timerActive && timerSeconds === null && (
                            <Button size="sm" variant="secondary" onClick={handleStartTimer}>
                              Start Timer
                            </Button>
                          )}
                          {timerSeconds !== null && (
                            <div className="flex flex-col items-center gap-2 mt-2 w-full">
                              <span className="font-mono text-lg">
                                {`${Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:${(timerSeconds % 60).toString().padStart(2, '0')}`}
                              </span>
                              {/* Progress Bar */}
                              {cookingInfo?.cookingTimeMinutes && (
                                <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-secondary/40">
                                  <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, (timerSeconds / (cookingInfo.cookingTimeMinutes * 60)) * 100))}%`,
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {timerActive ? (
                                  <Button size="sm" variant="outline" onClick={handlePauseTimer}>Pause</Button>
                                ) : timerSeconds > 0 ? (
                                  <Button size="sm" variant="outline" onClick={handleResumeTimer}>Resume</Button>
                                ) : null}
                                <Button size="sm" variant="ghost" onClick={handleResetTimer}>Reset</Button>
                              </div>
                            </div>
                          )}
                          {timerSeconds === 0 && (
                            <div className="text-green-600 font-bold mt-2">Time's up!</div>
                          )}
                        </div>
                      )}
                      {cookingInfo.menuSuggestions && cookingInfo.menuSuggestions.length > 0 && (
                        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-yellow-700 dark:text-yellow-300 text-lg">Menu Ideas</span>
                          </div>
                          <ul className="list-disc list-inside text-base text-foreground">
                            {cookingInfo.menuSuggestions.map((item, index) => <li key={index}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-base">
                      {isCameraInitializing ? "Initializing camera..." :
                        (hasCameraPermission === null ? "Checking camera permissions..." :
                          (imageUrl ? "Ready to get instructions!" : (hasCameraPermission ? "Take or upload a photo to begin." : "Enable camera access to take photos.")))}
                    </p>
                  )}
                </div>

                {/* Fun Cooking Tip */}
                <div className="mt-4 p-4 rounded-xl bg-primary/20 border border-primary/40 text-primary-foreground text-base text-center shadow-md font-semibold">
                  <span className="font-bold">🍴 Cooking Tip:</span> {getCookingTip(cookingInfo?.foodName)}
                </div>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

