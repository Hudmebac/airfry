import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function AirFryerInfo() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 bg-card/80 rounded-2xl shadow-2xl border-2 border-primary/30 mt-8">
      {/* Visual Section */}
      <div className="flex flex-col items-center mb-6">
        <Image src="/airfryerlogo.png" alt="Airfryer" width={80} height={80} className="mb-2" />
        <h1 className="text-3xl font-extrabold text-orange-500 drop-shadow-md flex items-center gap-2 mb-2 justify-center">
          <span role="img" aria-label="fire" className="animate-pulse">🔥</span>
          All About Air Frying
          <span role="img" aria-label="fire" className="animate-pulse">🔥</span>
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-xl mb-2">
          Welcome to your ultimate guide to air frying! Whether you're a total beginner or a crispy-food fanatic, you'll find everything you need to get the most out of your air fryer. Discover how it works, what you can cook, and how to keep it in top shape. Let's get crispy!
        </p>
      </div>
      {/* Fun Fact / Myth Busting */}
      <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-8 rounded shadow flex items-start gap-3">
        <span className="text-3xl">💡</span>
        <div className="text-base md:text-lg text-orange-900 font-semibold leading-relaxed">
          <span className="block mb-1"><span className="font-bold text-orange-700">Myth:</span> Air fryers are just mini deep fryers.</span>
          <span className="block"><span className="font-bold text-green-700">Fact:</span> Air fryers use hot air, not oil, to crisp food—making them much healthier and more versatile than deep fryers!</span>
        </div>
      </div>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">How an Air Fryer Works</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li><b>Hot Air Circulation:</b> Air fryers use a heating element and a fan to circulate hot air around the food, ensuring even cooking and a crispy exterior.</li>
          <li><b>Convection:</b> The powerful fan creates convection, cooking food quickly and evenly, similar to a convection oven but more intense.</li>
          <li><b>Reduced Oil:</b> Air frying requires significantly less oil than deep frying, making it a healthier option for crispy results <span className="italic">([source](https://www.goodhousekeeping.com/appliances/a28436830/what-is-an-air-fryer/))</span>.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">What You Can Cook</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li><b>Frozen favorites:</b> French fries, chicken nuggets, fish sticks, mozzarella sticks, and more.</li>
          <li><b>Fresh proteins:</b> Chicken wings, drumsticks, salmon, steak, pork chops, shrimp, tofu.</li>
          <li><b>Veggies:</b> Broccoli, Brussels sprouts, sweet potatoes, carrots, peppers, green beans, cauliflower.</li>
          <li><b>Baked goods:</b> Cookies, muffins, cinnamon rolls, and even small cakes.</li>
          <li><b>Reheating:</b> Pizza, fried chicken, and leftovers come out crispy instead of soggy.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Benefits of Using an Air Fryer</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li><b>Crispy and Delicious:</b> Delivers golden-brown, crispy results, similar to deep frying but with less oil.</li>
          <li><b>Healthier Cooking:</b> Less oil means lower fat and calorie intake, making it a healthier alternative <span className="italic">([source](https://www.goodhousekeeping.com/appliances/a28436830/what-is-an-air-fryer/))</span>.</li>
          <li><b>Convenience and Speed:</b> Air fryers are compact, easy to clean, and cook food faster than a conventional oven.</li>
          <li><b>Versatile Cooking:</b> Great for chicken, fries, veggies, fish, and even baked goods.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Best Practices & Tips</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li>Preheat your air fryer for 2-3 minutes for best results.</li>
          <li>Don't overcrowd the basket—leave space for air to circulate.</li>
          <li>Shake or flip food halfway through cooking for even crispiness.</li>
          <li>Use a light spray or brush of oil for extra crunch (especially for breaded foods).</li>
          <li>Pat food dry before air frying to maximize crispiness.</li>
          <li>Check food early—air fryers cook fast!</li>
          <li>Clean the basket and tray after each use to prevent smoke and keep flavors fresh.</li>
          <li>For battered foods, use a light oil spray to help them crisp up (wet batters don't work well).</li>
          <li>Let cooked food rest for a couple of minutes for juicier results.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Cleaning & Maintenance</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li>Always unplug and let your air fryer cool before cleaning.</li>
          <li>Most baskets and trays are dishwasher safe—check your manual.</li>
          <li>For hand washing, use warm soapy water and a non-abrasive sponge or brush.</li>
          <li>Clean the heating element and fan area regularly to prevent smoke and odors.</li>
          <li>Wipe the exterior with a damp cloth as needed.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Common Mistakes to Avoid</h2>
        <ul className="list-disc pl-6 space-y-1 text-base text-muted-foreground">
          <li>Overcrowding the basket—leads to uneven cooking.</li>
          <li>Not shaking or flipping food—results in soggy spots.</li>
          <li>Using too much oil—can cause smoke and soggy food.</li>
          <li>Skipping preheating—may lead to uneven results.</li>
          <li>Not checking food early—air fryers cook quickly!</li>
          <li>Neglecting to clean after use—can cause smoke and lingering odors.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Popular Foods & Settings</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded-lg bg-background">
            <thead>
              <tr className="bg-orange-100 text-orange-700">
                <th className="px-3 py-2 text-left">Food</th>
                <th className="px-3 py-2 text-left">Temp (°C)</th>
                <th className="px-3 py-2 text-left">Time (min)</th>
                <th className="px-3 py-2 text-left">Tip</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Chicken Wings</td><td>200</td><td>18-22</td><td>Flip halfway for even crispiness</td></tr>
              <tr><td>French Fries</td><td>200</td><td>15-20</td><td>Shake basket halfway</td></tr>
              <tr><td>Salmon</td><td>200</td><td>8-10</td><td>Brush with oil for moistness</td></tr>
              <tr><td>Broccoli</td><td>180</td><td>8-10</td><td>Toss in oil, season well</td></tr>
              <tr><td>Chicken Breast</td><td>200</td><td>12-15</td><td>Brush with oil for browning</td></tr>
              <tr><td>Steak</td><td>200</td><td>8-12</td><td>Let rest after cooking</td></tr>
              <tr><td>Frozen Foods</td><td>200</td><td>10-15</td><td>No need to thaw</td></tr>
              <tr><td>Vegetables</td><td>180</td><td>8-12</td><td>Cut evenly for best results</td></tr>
              <tr><td>Tofu</td><td>200</td><td>10-15</td><td>Press before air frying</td></tr>
              <tr><td>Pizza (reheat)</td><td>180</td><td>4-6</td><td>For a crispy crust</td></tr>
              <tr><td>Bacon</td><td>200</td><td>6-10</td><td>Lay strips in a single layer</td></tr>
              <tr><td>Brussels Sprouts</td><td>190</td><td>10-15</td><td>Halve and toss in oil</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Videos: Air Fryer Basics & Tips</h2>
        <div className="flex flex-col gap-4">
          <a href="https://www.goodhousekeeping.com/appliances/a28436830/what-is-an-air-fryer/" target="_blank" rel="noopener noreferrer" className="underline text-orange-600 font-semibold">Watch Good Housekeeping: What is an Air Fryer?</a>
          {/* You can embed YouTube videos here if you have direct links */}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Source & More Info</h2>
        <p className="text-sm text-muted-foreground">
          Content and tips adapted from <a href="https://www.goodhousekeeping.com/appliances/a28436830/what-is-an-air-fryer/" target="_blank" rel="noopener noreferrer" className="underline text-orange-600">Good Housekeeping: What is an Air Fryer?</a>
        </p>
      </section>
      <div className="text-center mt-8">
        <Link href="/" className="inline-block px-6 py-2 rounded-full bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition-all text-lg">Back to Air Fry Tool</Link>
      </div>
    </div>
  );
} 