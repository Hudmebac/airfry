'use client';

import {IdentifyFoodOutput, identifyFood} from '@/ai/flows/identify-food';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {toast} from '@/hooks/use-toast';
import {CameraIcon, UploadIcon, RefreshCwIcon, Loader2} from 'lucide-react';
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

  useEffect(() => {
    setCookingInfo(null);
  }, [imageUrl]);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const availableVideoDevices = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(availableVideoDevices);

        if (availableVideoDevices.length > 0) {
          let defaultDeviceId = availableVideoDevices[availableVideoDevices.length - 1].deviceId;
          const backCamera = availableVideoDevices.find(device => device.label.toLowerCase().includes('back'));
          if (backCamera) {
            defaultDeviceId = backCamera.deviceId;
          }
          setCurrentDeviceId(defaultDeviceId);

          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: defaultDeviceId } }
          });
          setMediaStream(stream);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
              await videoRef.current.play();
            } catch (playError) {
              console.error("Video play failed:", playError);
            }
          }
        } else {
           console.error('No video input devices found.');
           setHasCameraPermission(false);
           toast({
             variant: 'destructive',
             title: 'No Camera Found',
             description: 'Could not find any video input devices.',
           });
        }

      } catch (error) {
        console.error('Error accessing camera or devices:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions and ensure a camera is connected.',
        });
      }
    };

    setupCamera();

    return () => {
      mediaStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const switchCamera = useCallback(async () => {
    if (videoDevices.length < 2 || !currentDeviceId) return;

    const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDeviceId = videoDevices[nextIndex].deviceId;

    mediaStream?.getTracks().forEach(track => track.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDeviceId } }
      });
      setMediaStream(stream);
      setCurrentDeviceId(nextDeviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error("Video play after switch failed:", playError);
        }
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      toast({
        variant: 'destructive',
        title: 'Camera Switch Failed',
        description: 'Could not switch to the other camera.',
      });
    }
  }, [videoDevices, currentDeviceId, mediaStream]);

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

    try {
      const result = await identifyFood({photoUrl: imageUrl});
      if (result && 'foodName' in result) {
         setCookingInfo(result);
      } else {
         toast({
             title: 'Identification Failed',
             description: (result as any)?.message || 'Could not identify the food or get instructions.',
             variant: 'destructive',
         });
      }
    } catch (e: any) {
      console.error("Error getting cooking instructions:", e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to get cooking instructions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInstructions(false);
    }
  }, [imageUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-background">
      <Card className="w-full max-w-4xl rounded-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-foreground">Air Fryer Chef</CardTitle>
          <CardDescription className="text-muted-foreground">Upload or snap a photo of your food!</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="flex flex-col space-y-4">
            <div className="border rounded-md overflow-hidden relative aspect-square bg-muted">
              {imageUrl ? (
                <Image src={imageUrl} alt="Uploaded Food" layout="fill" objectFit="cover" />
              ) : (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  { !(hasCameraPermission) && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50">
                        <Alert variant="destructive" className="max-w-sm">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
                        </AlertDescription>
                        </Alert>
                    </div>
                  )
                  }
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                 <Input
                    type="file"
                    id="photoUrl"
                    name="photoUrl"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    />
                 <label htmlFor="photoUrl">
                    <Button asChild variant="outline">
                        <span className="flex items-center">
                        <UploadIcon className="h-4 w-4 mr-2" />
                        {imageUrl ? 'Change Image' : 'Upload Image'}
                        </span>
                    </Button>
                 </label>
                 {hasCameraPermission && !imageUrl && (
                     <>
                        <Button variant="outline" onClick={takeSnapshot}>
                            <CameraIcon className="h-4 w-4 mr-2" />
                            Take Photo
                        </Button>
                        {videoDevices.length > 1 && (
                            <Button variant="outline" size="icon" onClick={switchCamera} title="Switch Camera">
                                <RefreshCwIcon className="h-4 w-4" />
                            </Button>
                        )}
                     </>
                 )}
             </div>
          </div>

          <TooltipProvider delayDuration={300}>
            <div className="flex flex-col space-y-4">
                <Button
                  onClick={handleGetInstructions}
                  className="w-full"
                  disabled={!imageUrl || isLoadingInstructions}
                >
                  {isLoadingInstructions ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isLoadingInstructions ? 'Analyzing...' : 'Get Cooking Instructions'}
                </Button>

                <Separator />

                <div className="p-4 border rounded-md bg-muted/40 min-h-[200px] flex flex-col justify-center">
                {isLoadingInstructions ? (
                    <p className="text-center text-muted-foreground">Checking the cookbook...</p>
                ) : cookingInfo ? (
                    <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground text-center mb-3">{cookingInfo.foodName}</h2>
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
                        {imageUrl ? "Ready to get instructions!" : "Upload or take a photo to begin."}
                    </p>
                )}
                </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

