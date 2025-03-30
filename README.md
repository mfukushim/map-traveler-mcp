# Virtual Traveling bot environment for MCP

English / [Japanese](./README_jp.md)

This is an MCP server that creates an environment for an avatar to virtually travel on Google Maps.

From an MCP client such as Claude Desktop, you can give instructions to the avatar and report on the progress of its journey with photos.

<img alt="img_5.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_5.png" width="400"/>

> Now supports librechat https://www.librechat.ai/.

<img alt="libre0.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre0.png" width="400"/>

## Functions

#### MCP server tools function

The following functions can be used as an MCP server. The available functions vary depending on the settings and execution state.

You can specify the function name directly, but Claude LLM will automatically recognize it, so you can specify the operation in general terms.

Example:
"Where are you now?" "Let's leave for Tokyo Station."

- get_traveler_view_info(includePhoto:boolean,includeNearbyFacilities:boolean)  
  Gets information about the current travel avatar's location.  
  - includePhoto: Gets nearby Google Street View photos. If you have set up an image generation AI, it will synthesize the avatar.
  - includeNearbyFacilities: Gets information about nearby facilities.
- get_traveler_location()  
  Gets information about the current travel avatar's address and nearby facilities.
- reach_a_percentage_of_destination()
  Reach a specified percentage of the destination (moveMode=skip only)
  timeElapsedPercentage: Percent progress towards destination(0~100)
- set_traveler_location(address: string)  
  Sets the current travel avatar's location.
  - address: Address information (exact address, or general name that Google Maps or Claude can recognize, etc.)
- get_traveler_destination_address  
  Get the destination of the travel avatar you set
- set_traveler_destination_address(address: string)  
  Set the destination of the travel avatar
   - address: Address information (exact address, or general name that Google Maps or Claude can recognize, etc.)
- start_traveler_journey  
  Start the journey at the destination.(moveMode=realtime only)
- stop_traveler_journey  
  Stop the journey.(moveMode=realtime only)
- set_traveler_info(settings:string)  
  Set the traveler's attributes. Set the traveler's personality that you want to change dynamically, such as name and personality. However, if you use a role script, the script is more stable.
  - settings: Setting information such as name and personality.
- get_traveler_info  
  Get the traveler's attributes. Get the traveler's personality.
- set_avatar_prompt(prompt:string)  
  Set the prompt when generating the travel avatar image. The default is an anime-style woman. The anime style is enforced to prevent fake images.
  - prompt
- reset_avatar_prompt  
  Reset avatar generation prompts to default.
- get_sns_feeds  
  Gets Bluesky SNS articles for the specified custom feed (feeds containing a specific tag).
- get_sns_mentions  
  Gets recent mentions (likes, replies) to Bluesky SNS posts that you made yourself.
- post_sns_writer(message:string)  
  Posts an article to Bluesky SNS with the specified custom feed. Set a specific tag so that it can be determined that the post was generated by the travel bot.
  - message: article
- reply_sns_writer(message:string,id:string)  
  Reply to the article with the specified id. Set a specific tag so that it can be determined that the post was generated by the travel bot.
  - message: reply
  - id: The ID of the post to reply to
- add_like(id:string)  
  Add a like to the specified post.
  - id: The ID of the post to like
- tips  
  Guides you on how to set up features that have not yet been set.
- get_setting  
  Get environment and image settings.

#### MCP resources

Has three custom prompt samples.
When you import a prompt with Claude Desktop, Claude will act as a traveler.
The SNS-compatible version controls SNS input and output while having a travel conversation.

- role.txt  
  Claude will act as a traveler.

- roleWithSns.txt  
  Claude will act as a traveler. It also controls reading and posting to SNS.
- carBattle.txt  
  This is a small novel game about a story of transporting secret documents from Yokohama to Tokyo. Scenes are automatically generated. Set moveMode=skip to play.

## Setting

You will need to obtain and set access keys for multiple APIs, such as for accessing multiple Google maps and generating images.
Use of the API may incur charges.

#### Settings for using with Claude Desktop  
claude_desktop_config.json
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "@mfukushim/map-traveler-mcp"],
      "env":{
        "GoogleMapApi_key":"(Google Map API key)",
        "mapApi_url": "(Optional: Map API custom endpoint. Example: direction=https://xxxx,places=https://yyyy )",
        "time_scale": "(Optional:Scale of travel time on real roads duration. default 4)",
        "sqlite_path":"(db save path: e.g. %USERPROFILE%/Desktop/traveler.sqlite ,$HOME/traveler.sqlite )",
        "rembg_path": "(absolute path of the installed rembg cli)",
        "remBgUrl": "(rembg API URL)",
        "pixAi_key":"(pixAi API key)",
        "sd_key":"(or Stability.ai image generation API key)",
        "MT_GEMINI_API_KEY": "(or Gemini 2.0 Flash Experimental API  key)",
        "pixAi_modelId": "(Optional: pixAi ModelId, if not set use default model 1648918127446573124 ",
        "comfy_url": "(Option: Generate image using ComfyUI API at specified URL. Example: http://192.168.1.100:8188)",
        "comfy_workflow_t2i": "(Optional: Path to API workflow file when using text to image with ComfyUI. If not specified: assets/comfy/t2i_sample.json)",
        "comfy_workflow_i2i": "(Optional: Path of API workflow file when image to image in ComfyUI. If not specified: assets/comfy/i2i_sample.json)",
        "comfy_params": "(Optional: Variable values to send to the workflow via comfyUI API)",
        "fixed_model_prompt": "(Optional: Fixed avatar generation prompt. You will no longer be able to change your avatar during conversations.)",
        "bodyAreaRatio": "(Optional: Acceptable avatar image area ratio. default 0.042)",
        "bodyHWRatio": "(Optional: Acceptable avatar image aspect ratios. default 1.5~2.3)",
        "bodyWindowRatioW": "(Optional: Avatar composite window horizontal ratio. default 0.5)",
        "bodyWindowRatioH": "(Optional: Avatar composite window aspect ratio. default 0.75)",
        "bs_id":"(Bluesky sns registration address)",
        "bs_pass":"(bluesky sns password)",
        "bs_handle":"(bluesky sns handle name: e.g. xxxxxxxx.bsky.social )",
        "filter_tools": "(Optional: Directly filter the tools to be used. All are available if not specified. e.g. tips,set_traveler_location)",
        "moveMode": "(Option: Specify whether the movement mode is realtime or skip. default realtime)",
        "image_width": "(Option: Output image width (pixels) Default is 512)"
      }
    }
  }
}
```
Please set the following three Credentials for Google Map API.  
- Street View Static API
- Places API (New)
- Time Zone API
- Directions API

https://developers.google.com/maps/documentation/streetview/get-api-key

If you want to use the image generation AI, set either pixAi_key or sd_key. You also need to have python3.7~3.11 installed on your PC and rembg cli installed (virtual environment recommended).

https://platform.pixai.art/docs  
https://platform.stability.ai/docs/api-reference#tag/SDXL-1.0-and-SD1.6/operation/textToImage

The bluesky SNS address/password are optional. It is recommended that you create a dedicated account as it will post automatically.

https://bsky.app/

You can also run it in practice mode, which does not require an API key for verification.

#### Practice mode settings  
claude_desktop_config.json
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "@mfukushim/map-traveler-mcp"]
    }
  }
}
```

## How to use

#### Use the practice mode

1. Install nodejs 22.

2. Set up Claude Desktop for use.

3. Reflect one of the above settings in claude_desktop_config.json.

4. Restart Claude Desktop. It may take some time to set up (if an error occurs, try restarting Claude Desktop again. If it doesn't work, see the notes below). Make sure the following mark appears in the bottom right of the screen.

  <img alt="img_1.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_1.png" width="150"/>

5. Ask "Where are you now?" and "Go on a journey." A conversation will begin. When using the API, a confirmation screen will appear, so select Allow.

<img alt="img_4.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_4.png" width="200"/>

6. Select Attach from MCP and select role.txt.

<img alt="img_2.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_2.png" width="200"/>

<img alt="img_3.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_3.png" width="200"/>

7. A travel prompt has been built in, so feel free to talk to it.

#### Use the full feature

1. Get a Google Map API access key and set the permissions for Street View Static API, Places API (New), Time Zone API, and Directions API. Set this in the env of claude_desktop_config.json and restart.
   At this point, the travel log will be based on the real map. Travel images will also be output if they are not superimposed.
2. Decide on a path that will not interfere with the disk and set it in the sqlite_path of the env of claude_desktop_config.json. (Example: %USERPROFILE%/Desktop/traveler.sqlite $HOME/Documents/traveler.sqlite, etc.)
   At this point, your travel log will be saved and you can continue your journey even if you close Claude Desktop.
3. Install python 3.7 to 3.11 and install rembg with cli. We recommend using a virtual environment such as venv.
  ```bash
  python3 -m venv venv
  . venv/bin/activate or .\venv\Scripts\activate
  pip install "rembg[cpu,cli]"
  ```
  Check if rembg cli works properly using a sample image file. Input an image with a person in it, and if the person is cut out in the output file, it's OK.  
  ```bash
  rembg i source_image_file dest_image_file
  ```
4. rembg cli will be installed in the python exe location, so get the path. The file location varies depending on the OS and python installation status, but in the case of venv, it is (virtual environment name)\Scripts\rembg.exe or (virtual environment name)/bin/rembg above the directory you set. If you can't find it, search for the path with a file search software. Set that path to rembg_path of env in claude_desktop_config.json. (Example: "rembg_path": "C:\\Users\\xxxx\\Documents\\rembg_venv\\venv\\Scripts\\rembg.exe")
5. Get an image generation API key from the pixAI or Stability.ai site. Set the key to pixAi_key or sd_key in env of claude_desktop_config.json.
   The avatar will now be overlaid on the travel image.
6. Get the bluesky SNS address/password and handle name. Set these in bs_id, bs_pass, and bs_handle in env of claude_desktop_config.json, respectively.
   Import the travel knowledge prompt roleWithSns.txt to report travel actions to SNS (it will automatically post as a bot, so we recommend allocating a dedicated account)

Instead of preparing rembg with the cli, we have added a setting that allows you to handle rembg as a service API.  
If you configure the following rembg service, you can use rembg by setting the URL in remBgUrl.  

https://github.com/danielgatis/rembg?tab=readme-ov-file#rembg-s  

Setup is simple if you use the Docker version to launch a container and access it.  

https://github.com/danielgatis/rembg?tab=readme-ov-file#usage-as-a-docker  


#### When using external ComfyUI (for more advanced users)

You can also use a local ComfyUI as an image generation server. You can configure the image generation characteristics yourself in detail to reduce API costs.

However, the configuration will be quite complicated and image generation may take longer.

1. Configure ComfyUI to run in API mode.
2. Set the server URL to comfy_url in env.
3. Set detailed configuration values such as the model to be used in env in the form of a json string.
example.
```json
{
  "env": {
    "comfy_url": "http://192.168.1.100:8188",
    "comfy_workflow_t2i": "C:\\Documents\\t2itest.json",
    "comfy_workflow_i2i":"C:\\Documents\\i2itest.json",
    "comfy_params":"ckpt_name='animagineXL40_v40.safetensors',denoise=0.65"
  }
}
```
4. The default workflow can use assets/comfy/t2i_sample.json and assets/comfy/i2i_sample.json in the package. You can specify variables using % and specify the variables in comfy_params.

## Using libreChat

It has been adapted to work with libreChat. This makes it easier to use, but some additional settings are required.  
Also, it seems that it will not be stable unless the PC you use has a decent level of performance, such as one that can stably run Docker.

#### Install libreChat  

Please make sure it works as described on the official website.  
In this case, we recommend using Docker configuration due to additional settings.

https://www.librechat.ai/docs/local/docker  

Configure librechat.yaml using the official procedure.  
I think you will need to add a local or API LLM service.  

https://www.librechat.ai/docs/configuration/librechat_yaml  

Add a user for login.  

https://www.librechat.ai/docs/configuration/authentication#create-user-script  

Please set it so that you can have general chat conversations.  

#### Add a rembg container with additional settings  

To use rembg with Docker, add pulling and running the rembg Docker container.  

docker-compose.override.yml
```yml
 services:
   api:
     volumes:
       - type: bind
         source: ./librechat.yaml
         target: /app/librechat.yaml

   rembg:
     image: danielgatis/rembg:latest
     restart: always
     command: "s --host 0.0.0.0 --port 7000 --log_level info"

```

#### Add map-traveler-mcp to the MCP service  

Add librechat.yaml
```yaml
mcpServers:
  traveler:
    type: stdio
    command: npx
    args:
      - -y
      - "@mfukushim/map-traveler-mcp"
```

Add .env (Same as env in claude_desktop_config.json)

```env
# map-traveler-mcp
GoogleMapApi_key=(Google Map API key)
sqlite_path=/home/run_test.sqlite (e.g. librechat in an unobtrusive location inside the container, or in an external directory that you don't want to mount.)
remBgUrl=http://rembg:7000 (rembg Service API URL, container URL)
(Other settings such as image generation AI settings, PixAI key, stability.ai API key, ComfyUI settings, etc.)

```

After setting, restart the container.  
On slow PCs, mcp initialization may fail. Multiple restarts may work, but this may be difficult to run...

#### llibreChat settings

To use the MCP function in libreChat, use the Agents function.  

1. On the conversation screen, select Agents.  
   <img alt="libre1.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre1.png" width="200"/>
2. Select Agent Builder from the panel on the right side of the screen and configure your agent.  
   <img alt="libre2.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre2.png" width="200"/>
3. Select Add Tools to use map-traveler.  
   <img alt="libre3.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre3.png" width="200"/>
4. The agent tools screen will appear, so select and add all the map-traveler-mcp tools (if the map-traveler-mcp tools are not listed, MCP initialization has failed, so please restart the container or review the settings by checking the logs, etc.)  
   <img alt="libre4.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre4.png" width="200"/>  
   <img alt="libre5.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre5.png" width="200"/>  
5. Enter additional script in the instruction area.  
   Since libreChat does not have the MCP resource function, enter the content text of the following URL into the instruction area instead.   
   https://github.com/mfukushim/map-traveler-mcp/blob/main/assets/scenario/role.txt  
   <img alt="libre7.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre7.png" width="200"/>  
6. Click the Create button to save the agent.  
   <img alt="libre6.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre6.png" width="200"/>
7. Start a new chat.


## Install guide (Japanese, but lots of photos)

1. introduction and Practice mode  
   https://note.com/marble_walkers/n/n7a8f79e4fb30
2. DB, Google Map API, Image gen API  
   https://note.com/marble_walkers/n/n765257c27f3b
3. Avatar prompt  
   https://note.com/marble_walkers/n/nc7273724faea
4. SNS integration  
   https://note.com/marble_walkers/n/na7c956befe7b
5. Application 1  
   https://note.com/marble_walkers/n/n3c86edd8e817
6. ComfyUI API  
   https://note.com/marble_walkers/n/ncefc7c05d102  
7. Application 2  
   https://note.com/marble_walkers/n/ne7584ed231c8
8. LibreChat setting  
   https://note.com/marble_walkers/n/n339bf7905324

#### Additional about the source code

I use Effect.ts to simplify error management & for my own learning.  
We also use the Effect Service, but due to the way MCP calls work, we believe that consolidating it using the Service was not optimal.  
I think it would be simpler to handle the MCP calls directly in the Effect.

#### Notes on the latest updates

- Added MT_GEMINI_API_KEY to env. Images will be generated using the Gemini 2.0 Flash Experimental API key.
We plan to unify the env environment variables to standard uppercase snake case in the near future while maintaining compatibility.  
- Added image_width to env. The default is 512. Setting it smaller may reduce the cost of LLM API.  
