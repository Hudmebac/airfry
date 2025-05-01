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

  const handleGetInstructions = useCallback(async () => {
    if (!imageUrl) {
      toast({
        title: 'Info',
        description: 'Please upload or take a photo first.',
        variant: 'default',
      });
      return;
    }

    setIsLoadingInstructions(true);
    setCookingInfo(null);
    setIdentificationError(null);

    try {
      const result = await identifyFood({photoUrl: imageUrl});
      if (result && 'foodName' in result && result.foodName) {
         setCookingInfo(result);
      } else {
         setIdentificationError(
            (result as any)?.message || 'Could not identify the food. Please try taking another photo with better lighting or a clearer view.'
         );
         toast({
             title: 'Identification Failed',
             description: 'Please try another photo.',
             variant: 'destructive',
         });
      }
    } catch (e: any) {
      console.error("Error getting cooking instructions:", e);
      setIdentificationError(
         e.message || 'An error occurred while getting instructions. Please try again.'
      );
      toast({
        title: 'Error',
        description: 'Failed to get cooking instructions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [imageUrl]);

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
    msg += `\n#AirFryer \nLink: airfryer.netlify.app`;
    return msg;
  };

  // Handle share button click
  const handleShareClick = () => {
    setShareMessage(getShareMessage());
    setShareOpen(true);
  };

  // Handle Facebook share approval
  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://airfry.netlify.app/')}&quote=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-background">
      {/* Hidden audio element for timer sound */}
      <audio ref={timerAudioRef} src="/timer-done.mp3" preload="auto" />
      <Card className="w-full max-w-4xl rounded-2xl shadow-2xl border-2 border-primary/30 bg-card/80 backdrop-blur-md">
        <CardHeader className="text-center flex flex-col items-center gap-2 relative">
          <span className="text-4xl">🍳</span>
          <CardTitle className="text-3xl font-extrabold text-primary drop-shadow-sm flex items-center gap-2">
            Air Fryer Chef
          </CardTitle>
          <CardDescription className="text-muted-foreground">Upload or snap a photo of your food!</CardDescription>
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
                      <div className="mt-3 text-xs text-muted-foreground">Author: Craig Heggie<br/>URL: <a href="https://airfry.netlify.app/" className="underline" target="_blank" rel="noopener noreferrer">https://airfry.netlify.app/</a></div>
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

          <TooltipProvider delayDuration={300}>
            <div className="flex flex-col space-y-6">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full flex justify-center">
                        <Button
                            onClick={handleGetInstructions}
                            size="lg"
                            variant="default"
                            className="rounded-full px-8 py-4 text-lg font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                            disabled={!imageUrl || isLoadingInstructions || isCameraInitializing}
                            aria-label="Get Cooking Instructions"
                        >
                            {isLoadingInstructions ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
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

                {/* Manual Food Entry */}
                <div className="flex flex-col md:flex-row items-center gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Type food name (e.g. chicken wings)"
                    value={manualFoodName}
                    onChange={e => setManualFoodName(e.target.value)}
                    className="max-w-xs"
                    disabled={isLoadingInstructions}
                    onKeyDown={e => { if (e.key === 'Enter') handleManualFoodSubmit(); }}
                    aria-label="Manual food name entry"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleManualFoodSubmit}
                    disabled={!manualFoodName.trim() || isLoadingInstructions}
                    aria-label="Get Instructions for Manual Food Name"
                  >
                    Get Instructions
                  </Button>
                </div>

                {/* Favorites/History */}
                {foodHistory.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-semibold">Recent & Favorite Foods</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {foodHistory.map(f => (
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
                  </div>
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
                      <ShareDialogDescription>
                        <div className="mb-2">Choose how you want to share your meal and instructions:</div>
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
                      </ShareDialogDescription>
                    </ShareDialogHeader>
                  </ShareDialogContent>
                </ShareDialog>

                <div className="p-4 border-2 border-secondary/30 rounded-xl bg-secondary/60 min-h-[220px] flex flex-col justify-center shadow-sm">
                {isLoadingInstructions ? (
                    <p className="text-center text-muted-foreground">Checking the cookbook...</p>
                ) : identificationError ? (
                    <div className="text-center space-y-2">
                        <p className="text-destructive px-4 font-semibold">{identificationError}</p>
                        <p className="text-sm text-muted-foreground">(Confidence: 0%)</p>
                    </div>
                ) : cookingInfo ? (
                    <div className="space-y-3">
                    <h2 className="text-xl font-bold text-secondary text-center mb-1 flex items-center gap-2">{cookingInfo.foodName} <span>🥘</span></h2>
                     {cookingInfo.identificationConfidence !== undefined && cookingInfo.identificationConfidence !== null && (
                        <p className="text-center text-sm text-secondary-foreground mb-3">
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
                     <p>
                       <Tooltip>
                         <TooltipTrigger asChild>
                            <span className="font-semibold cursor-help underline decoration-dotted decoration-muted-foreground">Time:</span>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Cooking Time (Minutes)</p>
                         </TooltipContent>
                       </Tooltip>
                       {" "}{cookingInfo.cookingTimeMinutes} min
                       {/* Timer Button and UI */}
                       {typeof cookingInfo.cookingTimeMinutes === 'number' && (
                         <div className="mt-2">
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
                     </p>
                     <p>
                       <Tooltip>
                         <TooltipTrigger asChild>
                            <span className="font-semibold cursor-help underline decoration-dotted decoration-muted-foreground">Temp:</span>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Cooking Temperature (°C)</p>
                         </TooltipContent>
                       </Tooltip>
                       {" "}{cookingInfo.cookingTemperatureCelsius} °C
                     </p>
                    {cookingInfo.calorieEstimate && (
                        <p>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <span className="font-semibold cursor-help underline decoration-dotted decoration-muted-foreground">Est. Calories:</span>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>Estimated calories per typical serving</p>
                            </TooltipContent>
                        </Tooltip>
                        {" "}{cookingInfo.calorieEstimate} kcal
                        </p>
                    )}
                    {cookingInfo.menuSuggestions && cookingInfo.menuSuggestions.length > 0 && (
                        <div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <p className="font-semibold cursor-help underline decoration-dotted decoration-muted-foreground">Menu Ideas:</p>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>Suggested side dishes or pairings</p>
                            </TooltipContent>
                        </Tooltip>
                        <ul className="list-disc list-inside text-sm">
                            {cookingInfo.menuSuggestions.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                        </div>
                    )}
                    {cookingInfo.drinkSuggestion && (
                        <p>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <span className="font-semibold cursor-help underline decoration-dotted decoration-muted-foreground">Drink Pairing:</span>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>Suggested drink</p>
                            </TooltipContent>
                        </Tooltip>
                        {" "}{cookingInfo.drinkSuggestion}
                        </p>
                    )}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground">
                        {isCameraInitializing ? "Initializing camera..." :
                        (hasCameraPermission === null ? "Checking camera permissions..." :
                        (imageUrl ? "Ready to get instructions!" : (hasCameraPermission ? "Take or upload a photo to begin." : "Enable camera access to take photos.")))}
                    </p>
                )}
                </div>

                {/* Fun Cooking Tip */}
                <div className="mt-4 p-3 rounded-lg bg-primary/10 text-primary-foreground text-sm text-center shadow-sm">
                  <span className="font-semibold">🍴 Cooking Tip:</span> For best results, avoid overcrowding your air fryer basket!
                </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

