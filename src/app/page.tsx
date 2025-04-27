'use client';

import {IdentifyFoodOutput, identifyFood} from '@/ai/flows/identify-food';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {toast} from '@/hooks/use-toast';
import {CameraIcon, UploadIcon, RefreshCwIcon, Loader2, SearchIcon, RotateCcwIcon} from 'lucide-react';
import Image from 'next/image';
import {useRef, useState, useEffect, useCallback} from 'react';
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  useEffect(() => {
    setCookingInfo(null);
    setIdentificationError(null);
  }, [imageUrl]);

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-background">
      <Card className="w-full max-w-4xl rounded-2xl shadow-2xl border-2 border-primary/30 bg-card/80 backdrop-blur-md">
        <CardHeader className="text-center flex flex-col items-center gap-2">
          <span className="text-4xl">🍳</span>
          <CardTitle className="text-3xl font-extrabold text-primary drop-shadow-sm flex items-center gap-2">
            Air Fryer Chef
          </CardTitle>
          <CardDescription className="text-muted-foreground">Upload or snap a photo of your food!</CardDescription>
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

