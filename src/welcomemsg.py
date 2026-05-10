import discord
from discord.ext import commands
import aiosqlite
from datetime import datetime
import aiohttp
import tempfile
import os
import time
import asyncio
from concurrent.futures import ProcessPoolExecutor   
from image import create_welcome_card

# Create a process pool for CPU-heavy image generation
executor = ProcessPoolExecutor()

@bot.event
async def on_member_join(member):
    async with aiosqlite.connect("leveling.db") as db:
        cursor = await db.execute("SELECT welcome_channel FROM guild_settings WHERE guild_id = ?", (member.guild.id,))
        row = await cursor.fetchone()
        if not row or not row[0]:
            return
        channel = member.guild.get_channel(row[0])
        if not channel:
            return

        # 1. Download avatar to a temporary file
        avatar_url = member.display_avatar.url
        async with aiohttp.ClientSession() as session:
            async with session.get(avatar_url) as resp:
                if resp.status != 200:
                    return
                avatar_data = await resp.read()

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_avatar:
            tmp_avatar.write(avatar_data)
            avatar_temp_path = tmp_avatar.name

        # 2. Create a temporary output path for the welcome card
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_output:
            output_temp_path = tmp_output.name

        # 3. Generate the card (runs in a separate process to avoid blocking)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            executor,
            create_welcome_card,
            avatar_temp_path,
            member.display_name,   # or member.name
            output_temp_path,
            "background.jpg",      # your background image path
            "Sekuya-Regular.ttf"   # font path
        )

        # 4. Send the embed + the image as a file
        embed = discord.Embed(
            title=f"<:Tsuki:1495375018329374780> Welcome to {member.guild.name}! <:Tsuki:1495375018329374780>",
            description=f"Hello {member.mention}, we're thrilled to have you here!",
            color=discord.Color.from_rgb(109, 22, 179),
            timestamp=datetime.utcnow()
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        embed.add_field(name="🎁 Tip", value="Be active and level up to unlock roles, perks and more!", inline=True)
        embed.set_footer(text=f"User ID: {member.id}")

        # Send the message with both embed and the attached image
        with open(output_temp_path, "rb") as f:
            image_file = discord.File(f, filename="welcome_card.png")
            await channel.send(
                content=f"{member.mention}, Kindly go to <#1492487547715325993> read the rules and verify yourself to gain access to all channels.",
                embed=embed,
                file=image_file
            )

        # 5. Clean up temporary files (auto-delete)
        os.unlink(avatar_temp_path)
        os.unlink(output_temp_path)
