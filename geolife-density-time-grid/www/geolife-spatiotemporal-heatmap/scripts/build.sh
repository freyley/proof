#!/bin/bash

BUCKETNAME=covidwatch
FOLDERNAME=heatmap
CLOUDFRONT_INVALIDATION_ID=TODO_GET_FROM_JEFF

AWSPROFILE=$1
NOBUILD=$2

argquit() {
  echo "Please run this script from the root development folder of the nuxt app."
  echo "Syntax: "
  echo "    ./scripts/build.sh <awsprofile> [nobuild]"
  echo ""
  echo "    awsprofile: The name of your AWS profile. It should correspond to"
  echo "                a set of credentials in your ~/.aws/credentials"
  echo "                and config in ~/.aws/config files."
  echo ""
  echo "    nobuild: Specify this second argument if you have already performed"
  echo "             \`npm run generate\` and you just want to copy to S3."
  exit 1
}


if [ -z "$AWSPROFILE" ]; then
  echo "ERROR: <awsprofile> not provided."
  echo ""
  argquit
fi


if [ "$0" != "./scripts/build.sh" ]; then
  echo "ERROR: script not invoked in the correct directory."
  echo "Invoked as: $0"
  echo ""
  argquit
fi

if [ ! -z "$NOBUILD" ] && [ "$NOBUILD" != "nobuild" ]; then
  echo "ERROR: I don't understand the second positional argument: $NOBUILD"
  echo "The only valid value is \`nobuild\`"
  echo ""
  argquit
fi


echo
echo Using AWS as profile $AWSPROFILE
echo Deploying to: $BUCKETNAME
echo



if [ "$NOBUILD" != "nobuild" ]; then
  npm run generate
fi



S3_BUILDFOLDER_SUFFIX="`date +%s`"
S3_TARGET_URI="s3://$BUCKETNAME/$FOLDERNAME/" 
S3_BUILD_URI="s3://$BUCKETNAME/$FOLDERNAME--build-$S3_BUILD_SUFFIX/" 
S3_DEPRECATE_URI="s3://$BUCKETNAME/$FOLDERNAME--deprecate-$S3_BUILD_SUFFIX/" 


aws s3 --profile "$AWSPROFILE" cp --recursive dist/ "$S3_BUILD_URI" --acl public-read --cache-control max-age=31557600,public --metadata-directive REPLACE --expires 2034-01-01T00:00:00Z


aws s3 --profile "$AWSPROFILE" mv "$S3_TARGET_URI" "$S3_DEPRECATE_URI" 
aws s3 --profile "$AWSPROFILE" mv "$S3_BUILD_URI" "$S3_TARGET_URI" 
aws s3 --profile "$AWSPROFILE" rm "$S3_DEPRECATE_URI"



if [ ! -z "$CLOUDFRONT_INVALIDATION_ID" ]; then
  aws cloudfront create-invalidation \
      --profile lbd \
      --distribution-id $CLOUDFRONT_INVALIDATION_ID \
      --invalidation-batch "{\"Paths\": {\"Items\": [\"/*\"], \"Quantity\": 1}, \"CallerReference\":\"`date`\"}"
fi


